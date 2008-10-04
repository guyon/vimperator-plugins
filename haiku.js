// Vimperator plugin: "Update Haiku"
// Last Change: 22-Aug-2008. Jan 2008
// License: Creative Commons
// Maintainer: mattn <mattn.jp@gmail.com> - http://mattn.kaoriya.net/
//
// The script allows you to update Haiku status from Vimperator.
//
// Commands:
//  :haiku some thing text
//      post "some thing text" to keyword 'id:username' on hatena haiku.
//  :haiku #keyword some thing text
//      post "some thing text" to keyword 'id:keyword' on hatena haiku.
//  :haiku!/
//      show public timeline.
//  :haiku! someone
//      show someone's statuses.
//  :haiku! album
//      show aubum timeline.
//  :haiku!+ someone
//      fav someone's last status.. mean put hatena star.
//  :haiku!- someone
//      un-fav someone's last status.. mean remove hatena star.
//  :haiku! #keyword
//      show the keyword timeline.

(function(){
    var passwordManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
    var CLIENT_NAME = encodeURIComponent(liberator.config.name + "::plugin::haiku.js");
    var evalFunc = window.eval;
    var statuses = null;
    try {
        var sandbox = new Components.utils.Sandbox(window);
        if (Components.utils.evalInSandbox("true", sandbox) === true) {
            evalFunc = function(text) {
                return Components.utils.evalInSandbox(text, sandbox);
            }
        }
    } catch (e) { liberator.log('warning: haiku.js is working with unsafe sandbox.'); }

    function sprintf(format){
        var i = 1, re = /%s/, result = "" + format;
        while (re.test(result) && i < arguments.length) result = result.replace(re, arguments[i++]);
        return result;
    }
    function sayHaiku(username, password, stat){
        var keyword = '';
        var user = '', id = '';
        if (stat.match(/^#([^ ].+)\s+(.*)$/)) [keyword, stat] = [RegExp.$1, RegExp.$2];
        else if (stat.match(/^@([^\s#]+)(?:#(\d+))?\s+(.*)$/)) [user, id, stat] = [RegExp.$1, RegExp.$2, RegExp.$3];
        stat = stat.split("\\n").map(function(str) encodeURIComponent(str)).join("\n");
        //liberator.log({keyword:keyword,user:user,id:id,stat:stat},0);
        if (user && !(id && isValidStatusID(id))){
            id = getStatusIDFromUserID(user);
            if (!id) stat = "@" + user + "\n" + stat;
        }
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "http://h.hatena.ne.jp/api/statuses/update.json", false, username, password);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        var senddata = [
            "status=", stat,
            keyword ? "&keyword=" + encodeURIComponent(keyword) : id ? "&in_reply_to_status_id=" + id : "",
            "&source=" + CLIENT_NAME
        ].join('');
        //liberator.log('xhr.send(' + senddata +')',0);
        xhr.send(senddata);
    }
    function favHaiku(username, password, user){
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "http://h.hatena.ne.jp/api/statuses/user_timeline/" + user + ".json", false, username, password);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.send(null);
        xhr.open("POST", "http://h.hatena.ne.jp/api/favorites/create/" + evalFunc(xhr.responseText)[0].id + '.json', false, username, password);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.send(null);
    }
    function unfavHaiku(username, password, user){
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "http://h.hatena.ne.jp/api/statuses/user_timeline/" + user + ".json?count=1", false, username, password);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.send(null);
        xhr.open("POST", "http://h.hatena.ne.jp/api/favorites/destroy/" + evalFunc(xhr.responseText)[0].id + '.json', false, username, password);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.send(null);
    }
    function isValidStatusID(id){
        if (!statuses) return false;
        return statuses.some(function(status) status.id == id);
    }
    function getStatusIDFromUserID(userid){
        if (!statuses) return null;
        return statuses.filter(function(status) status.in_reply_to_user_id == userid)[0].id;
    }
    function getTimelineURLFromTarget(target){
        if (target == "/"){
            return "http://h.hatena.ne.jp/api/statuses/public_timeline.json";
        } else if (target == "album"){
            return "http://h.hatena.ne.jp/api/statuses/album.json";
        } else if (/^#(.+)/.test(target)){
            return "http://h.hatena.ne.jp/api/statuses/keyword_timeline/" +
                   encodeURIComponent(RegExp.$1) + ".json";
        } else if (/^@?(.+)/.test(target)){
            return "http://h.hatena.ne.jp/api/statuses/user_timeline/" + RegExp.$1 + ".json";
        }
        return "http://h.hatena.ne.jp/api/statuses/friends_timeline.json";
    }
    function showFollowersStatus(username, password, target){
        var xhr = new XMLHttpRequest();
        var endPoint = getTimelineURLFromTarget(target);
        /*
        var endPoint = target ?
            target == "/" ?
            "http://h.hatena.ne.jp/api/statuses/public_timeline.json"
          : "http://h.hatena.ne.jp/api/statuses/user_timeline/" + target + ".json"
          : "http://h.hatena.ne.jp/api/statuses/friends_timeline.json";
        */
        xhr.open("POST", endPoint, false, username, password);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.send(null);
        statuses = evalFunc(xhr.responseText);

        var html = <style type="text/css"><![CDATA[
            span.haiku.entry-title { text-decoration: underline; }
            span.haiku.entry-content { white-space: normal; }
            span.haiku.entry-content a { text-decoration: none; }
            img.haiku.photo { border; 0px; width: 16px; height: 16px; vertical-align: baseline; }
        ]]></style>.toSource()
                   .replace(/(?:\r?\n|\r)[ \t]*/g, " ") +
            statuses.map(function(status) {
                var text = status.text;
                var keyword = status.keyword;
                var star = status.favorited > 0 ? '<img src="http://s.hatena.ne.jp/images/star.gif"/><span style="color:orange;">x' + status.favorited + '</span>' : '';
                if (text.indexOf(keyword+"=") == 0) text = status.text.substr(keyword.length + 1);
                text = convert(text);
                keyword = convert(keyword);
                return <>
                    <img src={status.user.profile_image_url}
                         alt={status.user.screen_name}
                         title={status.user.screen_name}
                         class="haiku photo"/>
                    <strong>{status.user.name}&#x202C;</strong>
                </>.toSource()
                   .replace(/(?:\r?\n|\r)[ \t]*/g, " ") +
                   star +
                   sprintf(': <span class="haiku entry-title">%s</span><br /><span class="haiku entry-content">%s&#x202C;</span><hr />',
                       keyword, text)
            }).join("");

        //liberator.log(html);
        liberator.echo(html, true);
    }
    function convert(str){
        function createHTML(all){
            var str = '';
            if (all.indexOf("id:") == 0){
                str = '<a href="http://h.hatena.ne.jp/' + all.replace(":", "/") + '">' + all + '</a>'
            } else if (/\.(?:jpe?g|gif|png|bmp)$/.test(all)){
                str = '<img src="' + all + '"/>';
            } else if (/^http:\/\/(?:[^.]+\.)?youtube\.com\/(?:watch\?(?:[^&]+&)*v=|v\/)([^&=#?;\/]+)/.test(all)){
                var url = "http://www.youtube.com/v/" + RegExp.$1 + "&fs=1";
                str = '<a href="#" class="hl-URL">' + url + '</a>\n' +
                      '<div><object width="300" height="250" data="' + url + '" type="application/x-shockwave-flash">' +
                      '<param name="wmode" value="transparent"/>' +
                      '<param name="allowFullScreen" value="true"/>' +
                      '</object></div>';
            } else if (/^http:\/\/www\.nicovideo\.jp\/watch\/([-\w]+)$/.test(all)){
                str = '<iframe width="312" height="176" src="http://ext.nicovideo.jp/thumb/'+RegExp.$1+'" scrolling="no">'+
                      '<a href="' + all + '">' + all + '</a></iframe>';
            } else {
                if (all.charAt(0) == "<")
                    str = all.replace(/(?:href|src)="(?=\/)/g,'$&http://h.hatena.ne.jp');
                else
                    str = '<a href="#" class="hl-URL">' + all + '</a>';
            }
            return str;
        }
        return str.replace(/<[^>]+>|https?:\/\/[-\w!#$%&'()*+,.\/:;=?@~]+|id:[a-zA-Z][-\w]{1,30}[a-zA-Z\d]/g, createHTML)
                  .replace("\n","<br/>","g");
    }
    liberator.commands.addUserCommand(["haiku"], "Change Haiku status",
        function(arg, special){
            var password;
            var username;
            try {
                var logins = passwordManager.findLogins({}, 'http://h.hatena.ne.jp', null, 'http://h.hatena.ne.jp (API)');
                if (logins.length)
                    [username, password] = [logins[0].username, logins[0].password];
                else {
                    var ps = Cc['@mozilla.org/embedcomp/prompt-service;1'].getService(Ci.nsIPromptService);
                    var [user,pass] = [{ value : '' }, { value : '' }];
                    var ret = ps.promptUsernameAndPassword(
                        window, 'http://h.hatea.ne.jp (API)', 'Enter username and password.\nyou can get "password" from\n\thttp://h.hatena.ne.jp/api#auth', user, pass, null, {});
                    if(ret){
                        username = user.value;
                        password = pass.value.replace(/@.*$/, '');
                        var nsLoginInfo = new Components.Constructor(
                            '@mozilla.org/login-manager/loginInfo;1', Ci.nsILoginInfo, 'init');
                        loginInfo = new nsLoginInfo('http://h.hatena.ne.jp', null, 'http://h.hatena.ne.jp (API)', username, password, '', '');
                        passwordManager.addLogin(loginInfo);
                    } else
                        throw 'Haiku: account not found';
                }
            }
            catch (ex){
                liberator.echoerr(ex);
            }

            arg = arg.replace(/%URL%/g, liberator.buffer.URL)
                     .replace(/%TITLE%/g, liberator.buffer.title);

            if (special && arg.match(/^\+\s*(.*)/))
                favHaiku(username, password, RegExp.$1)
            else
            if (special && arg.match(/^-\s*(.*)/))
                unfavHaiku(username, password, RegExp.$1)
            else
            if (special || arg.length == 0)
                showFollowersStatus(username, password, arg)
            else
                sayHaiku(username, password, arg);
        }, {
            completer: function(filter, special){
                if (!filter || !statuses) return [0,[]];
                var matches= filter.match(/^([@#]|[-+]\s*)([^\s]*)$/);
                if (!matches) return [0,[]];
                var list = [];
                var [prefix, target] = [matches[1],matches[2]];
                switch (prefix.charAt(0)){
                    case "+":
                    case "-":
                        if (!special) return;
                    case "@":
                        if (special)
                            list = statuses.map(function(entry) [entry.user.id, entry.text]);
                        else
                            list = statuses.map(function(entry) [entry.user.id + "#" + entry.id, entry.text]);
                        break;
                    case "#":
                        list = statuses.map(function(entry) [entry.keyword, entry.text]);
                        break;
                }
                if (target){
                    list = list.filter(function($_) $_[0].indexOf(target) >= 0);
                }
                return [prefix.length, list];
            }
        }
    );
})();
// vim:sw=4 ts=4 et:
