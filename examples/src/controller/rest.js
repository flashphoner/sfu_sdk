const SFU_PATH = "/rest-api/sfu/";

const createConnection = function(url, roomName) {
    const stats = function() {
        return send(url + SFU_PATH + "stats", {
            roomName: roomName
        });
    }
    return {
        stats: stats
    }
}


/** XHR WRAPPER **/
const send = function(uri, data, responseIsText) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        if (data) {
            xhr.open('POST', uri, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        } else {
            xhr.open('GET', uri, true);
        }
        xhr.responseType = 'text';
        xhr.onload = function (e) {
            if (this.status === 200) {
                if (this.response) {
                    if (!responseIsText) {
                        resolve(JSON.parse(this.response));
                    } else {
                        resolve(this.response);
                    }
                } else {
                    resolve();
                }
            } else {
                reject(this);
            }
        };
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4){
                if(xhr.status === 200){
                    //success
                } else {
                    reject();
                }
            }
        };
        if (data) {
            xhr.send(JSON.stringify(data));
        } else {
            xhr.send();
        }
    });
};