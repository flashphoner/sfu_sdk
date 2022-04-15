const stripCodecs = function(sdp, codecs) {
    if (!codecs.length) return sdp;
    var sdpArray = sdp.split("\n");
    var codecsArray = codecs.split(",");

    //search and delete codecs line
    var pt = [];
    var i;
    for (var p = 0; p < codecsArray.length; p++) {
        console.log("Searching for codec " + codecsArray[p]);
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i].search(new RegExp(codecsArray[p],'i')) !== -1 && sdpArray[i].indexOf("a=rtpmap") === 0) {
                console.log(codecsArray[p] + " detected");
                pt.push(sdpArray[i].match(/[0-9]+/)[0]);
                sdpArray[i] = "";
            }
        }
    }
    if (pt.length) {
        //searching for fmtp
        for (p = 0; p < pt.length; p++) {
            for (i = 0; i < sdpArray.length; i++) {
                if (sdpArray[i].search("a=fmtp:" + pt[p]) !== -1 || sdpArray[i].search("a=rtcp-fb:" + pt[p]) !== -1) {
                    sdpArray[i] = "";
                }
            }
        }

        //delete entries from m= line
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i].search("m=audio") !== -1 || sdpArray[i].search("m=video") !== -1) {
                var mLineSplitted = sdpArray[i].split(" ");
                var newMLine = "";
                for (var m = 0; m < mLineSplitted.length; m++) {
                    if (pt.indexOf(mLineSplitted[m].trim()) === -1 || m <= 2) {
                        newMLine += mLineSplitted[m];
                        if (m < mLineSplitted.length - 1) {
                            newMLine = newMLine + " ";
                        }
                    }
                }
                sdpArray[i] = newMLine;
            }
        }
    }

    //normalize sdp after modifications
    var result = "";
    for (i = 0; i < sdpArray.length; i++) {
        if (sdpArray[i] !== "") {
            result += sdpArray[i] + "\n";
        }
    }
    return result;
}

const stripVideoCodecsExcept = function (sdp, codec) {
    let actualStripCodec = "rtx";
    if (codec === "VP8") {
        actualStripCodec += ",H264";
    } else if (codec === "H264") {
        actualStripCodec += ",VP8";
    } else {
        return sdp;
    }
    return stripCodecs(sdp, actualStripCodec);
}
