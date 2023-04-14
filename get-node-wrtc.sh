#!/bin/sh

# get-node-wrtc.sh
# The script is used in get-wrtc operation:
#
# npm run get-wrtc
#
# This provides a patched node-webrtc binary to support arg free setLocalDescription() implementation

FILE=wrtc.node
FOLDER=$(pwd)/node_modules/wrtc/build/Release

if [ ! -d $FOLDER ]; then
    echo "No folder to download $FILE, skip the step"
    exit 0
fi

URL=$1
if [ -z $URL ]; then
    URL=https://flashphoner.com/downloads/builds/flashphoner_client/node-webrtc/1.0/current/wrtc.node
fi

USR=$2
PASSWD=$3

COMMAND=$(command -v wget 2>/dev/null)
KEYS="--no-check-certificate -q"
if [ ! -z $USR ]; then
    KEYS="$KEYS --user=$USR"
fi
if [ ! -z $PASSWD ]; then
    KEYS="$KEYS --password=$PASSWD"
fi

if [ -z $COMMAND ]; then
    COMMAND=$(command -v curl 2>/dev/null)
    KEYS=""
    if [ ! -z $USR ]; then
        KEYS="-u $USR"
    fi
    if [ ! -z $PASSWD ]; then
        KEYS="$KEYS:$PASSWD"
    fi
    KEYS="$KEYS -Lkso $FILE"
fi

if [ -z $COMMAND ]; then
    echo "No download tools available. Install wget or curl"
    exit 1
fi

cd $FOLDER

if [ -f $FILE ]; then
    echo "Remove previous $FILE"
    mv -f $FILE $FILE.bak
fi

echo "Download $FILE to $(pwd)"
$COMMAND $KEYS $URL
RESULT=$?
if [ $? -ne 0 ]; then
    echo "$FILE download failed: error $RESULT"
    mv $FILE.bak $FILE
    exit $RESULT
fi
if [ ! -f $FILE ]; then
    echo "$FILE download failed: not available"
    mv $FILE.bak $FILE
    exit 1
fi

echo "$FILE downloaded successfully"
chmod +x $FILE
