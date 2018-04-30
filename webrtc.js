'use strict';
var WebrtcConnection = function(userName,
                                channelName,
                                pcConfig, startCallBtn,
                                endCallBtn, muteCallBtn, localVideoDiv,
    remoteVideoDiv, callType,
chatSendBtn,chatMessageInput,chatMessageDiv,localVideoScreenDiv,remoteVideoScreenDiv,
shareScreenBtn,fileShareDiv)
{
    var userName = userName;
    var channelName = channelName;
    var pcConfig = pcConfig;
    var isInitiatorVideo = false;
    var isInitiatorDataChannel = false;
    var localVideoStream;
    var remoteVideoStream;
    var remoteVideoScreenStream;
    var localVideoScreenStream;
    var localVideoDiv = localVideoDiv;
    var remoteVideoDiv = remoteVideoDiv;
    var localVideoScreenDiv = localVideoScreenDiv;
    var remoteVideoScreenDiv = remoteVideoScreenDiv;
    var VideoPeerConnection;
    var DataPeerConnection;
    var presence;
    var channel;
    var ably = new Ably.Realtime({authUrl: '/auth/api/' + channelName});
    var callType = callType;
    var callMute = true;
    var startCallBtn = startCallBtn;
    var endCallBtn = endCallBtn;
    var shareScreenBtn = shareScreenBtn;
    var receiveProgress ;
    startCallBtn.disabled = true;
    startCallBtn.style.visibility = 'visible';
    shareScreenBtn.disabled = true;
    shareScreenBtn.style.visibility = 'visible';
    endCallBtn.disabled = true;
    endCallBtn.style.visibility = 'hidden';

    var muteCallBtn = muteCallBtn;
    muteCallBtn.disabled = true;
    muteCallBtn.style.visibility = 'hidden';
    var chatSendBtn = chatSendBtn;
    chatSendBtn.disabled = true;
    var chatMessageInput = chatMessageInput;
    chatMessageInput.disabled = true;
    var chatMessageDiv = chatMessageDiv;


var fileShareDiv = fileShareDiv;
var shareFileMessage = document.createElement("i");
    shareFileMessage.innerHTML = "Waiting for the connection to be established...";
var container;
var peername;
var filelist;
var fileinput;
var recievedfile;
var sentfile;
var recieveditem;
var sentitem;
var span;
var sendProgress;
var sendChannel;
var is_screenshared = false;
var receiveChannel;
var receiveBuffer = [];
var receivedSize = 0;
var bytesPrev = 0;
var timestampPrev = 0;
var timestampStart;
var statsInterval = null;
var bitrateMax = 0;


    var sendMessage = function(message)
    {
        message['userName'] = userName;
        channel.publish(channelName, JSON.stringify(message));
        console.log('Message Sent on Channel from : ' + userName + ' : '+ JSON.stringify(message));
    };
    var createPeerConnection = function()
    {
        try
        {
            VideoPeerConnection = new RTCPeerConnection(pcConfig);
            console.log('Video PeerConnection Created Successfully');
            VideoPeerConnection.onicecandidate = handleIceCandidate;
            VideoPeerConnection.onaddstream = handleRemoteStreamAdded;
            VideoPeerConnection.onremovestream = handleRemoteStreamRemoved;
            if (isInitiatorVideo)
            {
                VideoPeerConnection.createOffer(setLocalAndSendMessage, handleCreateOfferError);
            }
        }
        catch (e)
        {
            console.log('Failed to create Video PeerConnection, exception: ' + e.message);
        }
        try
        {
            DataPeerConnection = new RTCPeerConnection(pcConfig);
            console.log('Data PeerConnection Created Successfully');
            DataPeerConnection.onicecandidate = handleIceCandidateData;
            DataPeerConnection.onaddstream = handleRemoteScreenStreamAdded;
            DataPeerConnection.onremovestream = handleRemoteScreenStreamRemoved;
            DataPeerConnection.ondatachannel = receiveChannelCallback;
            if (isInitiatorDataChannel)
            {
                DataPeerConnection.createOffer(setLocalAndSendMessageData, handleCreateOfferError);
            }
        }
        catch (e)
        {
            console.log('Failed to create Video PeerConnection, exception: ' + e.message);
        }
    };

    var activateButtons = function()
    {

        startCallBtn.disabled = false;
        startCallBtn.style.visibility = 'visible';
        endCallBtn.disabled = true;
        endCallBtn.style.visibility = 'hidden';
        chatSendBtn.disabled = false;
        chatMessageInput.disabled = false;

        shareScreenBtn.disabled = false;
        shareScreenBtn.style.visibility = 'visible';

    };
    var sendMessageBtn = function () {
        var msg = userName +" : "+chatMessageInput.value;
        if(msg.length > 0){
          sendMessage({"msg":msg,'type':"msg"});
            msg = msg.replace(userName +" : ", "me : ");
            var chatMessage = document.createElement('p');
            chatMessage.innerHTML = msg+moment().fromNow();
            chatMessageDiv.prepend(chatMessage);
            chatMessageInput.value = '';
        }
    };
    var sendMessageInput = function (e) {
        if ( e.keyCode == 13 ) // Enter key = keycode 13
          {
            e.preventDefault();

             var msg = userName +" : "+chatMessageInput.value;
            if(msg.length > 0){
              sendMessage({"msg":msg,'type':"msg"});
                msg = msg.replace(userName +" : ", "me : ");
                var chatMessage = document.createElement('p');
            chatMessage.innerHTML = msg+moment().fromNow();
                chatMessageDiv.prepend(chatMessage);
                chatMessageInput.value = '';
            }
            return false;
          }
    };
    var startCall = function()
    {
    	var callTypeFlag;
        if (callType === 'video')
        {
            callTypeFlag = true;
        }
        else if (callType === 'audio')
        {
         	callTypeFlag = false;   
        }
        navigator.mediaDevices.getUserMedia(
            {
                audio: callMute,
                video: callTypeFlag
            }).then(gotStream).catch(function(e)
            {
                alert('getUserMedia() error: ' + e.name);
            });
    };
    var gotStream = function(stream)
    {
        localVideoStream = stream;
        var video = document.createElement("video");
        video.setAttribute("playsinline", "");
        video.autoplay = true;
        video.srcObject = stream;
        video.controls = true;
        video.muted = 'muted';
        video.style.width = '100%';
        //    video.style.transform = 'rotateY(-180deg)';
        localVideoDiv.appendChild(video);
        VideoPeerConnection.addStream(localVideoStream);
        VideoPeerConnection.createOffer(setLocalAndSendMessage, handleCreateOfferError);
        startCallBtn.disabled = true;
        startCallBtn.style.visibility = 'hidden';
        endCallBtn.disabled = false;
        endCallBtn.style.visibility = 'visible';

        muteCallBtn.disabled = false;
        muteCallBtn.style.visibility = 'visible';
        console.log('local stream added.');
    };
    var handleIceCandidateData = function(event)
    {
        console.log('DataPeerConnection icecandidate event: ', event);
        if (event.candidate)
        {
            sendMessage(
            {
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate,
                isDataChannel: true
            });
        }
        else
        {
            console.log('DataPeerConnection End of candidates.');
        }
    };
    var handleIceCandidate = function(event)
    {
        console.log('VideoPeerConnection icecandidate event: ', event);
        if (event.candidate)
        {
            sendMessage(
            {
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate,
                isDataChannel: false
            });
        }
        else
        {
            console.log('VideoPeerConnection End of candidates.');
        }
    };
    var handleCreateOfferError = function(event)
    {
        console.log('createOffer() error: ', event);
    };
    var doAnswer = function(isDataChannelFlag)
    {
        if (isDataChannelFlag)
        {
            DataPeerConnection.createAnswer().then(setLocalAndSendMessageData, onCreateSessionDescriptionError);
            console.log('Sending DataPeerConnection answer to peer.');
        }
        else
        {
            VideoPeerConnection.createAnswer().then(setLocalAndSendMessage, onCreateSessionDescriptionError);
            console.log('Sending VideoPeerConnection answer to peer.');
        }
    };
    var setLocalAndSendMessage = function(sessionDescription)
    {
        VideoPeerConnection.setLocalDescription(sessionDescription);
        console.log('setLocalAndSendMessage Video sending message', sessionDescription);
        sendMessage(
        {
            type: sessionDescription.type,
            sdp: sessionDescription.sdp,
            isDataChannel: false
        });
    };
    var setLocalAndSendMessageData = function(sessionDescription)
    {
        DataPeerConnection.setLocalDescription(sessionDescription);
        console.log('setLocalAndSendMessage Data sending message', sessionDescription);
        sendMessage(
        {
            type: sessionDescription.type,
            sdp: sessionDescription.sdp,
            isDataChannel: true
        });
    };
    var onCreateSessionDescriptionError = function(error) {
        console.log('Failed to create session description: ' + error.toString());
    };
    var handleRemoteStreamAdded = function(event)
    {
        remoteVideoStream = event.stream;
        var video = document.createElement("video");
        video.setAttribute("playsinline", "");
        video.autoplay = true;
        video.srcObject = event.stream;
        video.controls = true;
        video.style.width = '100%';
        remoteVideoDiv.appendChild(video);
        console.log('Remote stream added.');
    };
    var handleRemoteStreamRemoved = function(event)
    {
        VideoPeerConnection.removeStream(remoteVideoStream);
        remoteVideoStream = null;
        remoteVideoDiv.innerHTML = '';
        console.log('Remote stream removed.');
    };
    var muteCall = function()
    {
        if (!callMute)
        {
            var audioTracks = VideoPeerConnection.getLocalStreams()[0].getAudioTracks();
            if (audioTracks.length !== 0)
            {
                for (var i = 0; i < audioTracks.length; ++i)
                {
                    audioTracks[i].enabled = !callMute;
                }
            }
            callMute = !callMute;
            muteCallBtn.innerHTML = 'Mute';
            console.log('Video is not muted.');
        }
        else
        {
            var audioTracks = VideoPeerConnection.getLocalStreams()[0].getAudioTracks();
            if (audioTracks.length !== 0)
            {
                for (var i = 0; i < audioTracks.length; ++i)
                {
                    audioTracks[i].enabled = !callMute;
                }
            }
            callMute = !callMute;
            muteCallBtn.innerHTML = 'Muted';
            console.log('Video is Muted.');
        }
    };
    var endCall = function()
    {
        VideoPeerConnection.removeStream(localVideoStream);
        localVideoStream;
        localVideoDiv.innerHTML = '';
        VideoPeerConnection.createOffer(setLocalAndSendMessage, handleCreateOfferError);
        startCallBtn.disabled = false;
        startCallBtn.style.visibility = 'visible';
        endCallBtn.disabled = true;
        endCallBtn.style.visibility = 'hidden';
        muteCallBtn.disabled = true;
        muteCallBtn.style.visibility = 'hidden';
        console.log('local stream removed.');
    };
    var reset = function()
    {
        VideoPeerConnection.close();
        VideoPeerConnection;
        isInitiatorVideo = false;
        remoteVideoStream;
        remoteVideoDiv.innerHTML = '';
        localVideoStream;
        localVideoDiv.innerHTML = '';
        console.log('VideoPeerConnection is closed.');
        DataPeerConnection.close();
        DataPeerConnection;
        isInitiatorDataChannel = false;
        console.log('DataPeerConnection is closed.');
        startCallBtn.disabled = true;
        startCallBtn.style.visibility = 'visible';
        endCallBtn.disabled = true;
        endCallBtn.style.visibility = 'hidden';
        muteCallBtn.disabled = true;
        muteCallBtn.style.visibility = 'hidden';
    };
    var InitiateConnections = function()
    {
        if (ably && ably.auth && ably.auth.tokenDetails)
        {
            clearInterval(timer);
            console.log(ably.auth.tokenDetails);
            channel = ably.channels.get(channelName);
            presence = channel.presence;
            channel.history(function (err, resultPage) {

                    if (resultPage.items.length > 0) {
                        for (var i = resultPage.items.length; i > 0; i--) {
                            var m = JSON.parse(resultPage.items[i - 1].data);
                            if (m.type == 'msg') {
                                if (~m.msg.indexOf(userName +" : "))
                                {
                                    m.msg = m.msg.replace(userName +" : ", "me : ");
                                    var chatMessage = document.createElement('p');
                                    chatMessage.innerHTML = m.msg+moment().fromNow();
                                    chatMessageDiv.prepend(chatMessage);

                                }
                                else
                                {
                                    var chatMessage = document.createElement('p');
                                    chatMessage.innerHTML = m.msg+moment().fromNow();
                                    chatMessageDiv.prepend(chatMessage);
                                }

                            }
                        }
                    }
                });
            channel.subscribe(channelName, function(message)
            {
                message.data = JSON.parse(message.data);
                if (message.data.userName != userName)
                {
                    if (message.data.type === 'offer')
                    {
                        if (message.data.isDataChannel)
                        {
                            DataPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                        }
                        else
                        {
                            VideoPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                        }
                        doAnswer(message.data.isDataChannel);
                        // activateButtons();
                    }
                    else if (message.data.type === 'answer')
                    {
                    if (message.data.isDataChannel)
                    {
                        DataPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    else
                    {
                        VideoPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    // activateButtons();
                }
                    else if (message.data.type === 'candidate')
                    {
                    if (message.data.isDataChannel)
                    {
                        var candidate = new RTCIceCandidate(
                        {
                            sdpMLineIndex: message.data.label,
                            candidate: message.data.candidate
                        });
                        DataPeerConnection.addIceCandidate(candidate);
                    }
                    else
                    {
                        var candidate = new RTCIceCandidate(
                        {
                            sdpMLineIndex: message.data.label,
                            candidate: message.data.candidate
                        });
                        VideoPeerConnection.addIceCandidate(candidate);
                    }
                }
                else if (message.data.type === 'msg') {
                            message.data.msg = message.data.msg.replace(userName +" : ", "me : ");
                            var chatMessage = document.createElement('p');
                                    chatMessage.innerHTML = message.data.msg+moment().fromNow();
                                    chatMessageDiv.prepend(chatMessage);


                        } else if (message.data.file) {
                            console.log(message.data);
                            recievedfile = message.data;
                            recieveditem = document.createElement('li');
                          recieveditem.className = 'receiving';

                          // make a label
                            var div_row = document.createElement('div');
                            div_row.className = 'row';
                            var div_col = document.createElement('div');
                            div_col.className = 'col-xs-3';
                          var span = document.createElement('span');
                          span.className = 'filename';
                          span.appendChild(document.createTextNode(recievedfile.name));
                          div_col.appendChild(span);
                          div_row.appendChild(div_col);
//                          item.appendChild(span);
                        var div_col = document.createElement('div');
                            div_col.className = 'col-xs-3';
                          span = document.createElement('span');
                          span.appendChild(document.createTextNode(recievedfile.size + ' bytes'));
                          div_col.appendChild(span);
                          div_row.appendChild(div_col);
                          recieveditem.appendChild(div_row);
                          filelist.appendChild(recieveditem);
                          var div_col = document.createElement('div');
                            div_col.className = 'col-xs-3';
                            receiveProgress = document.createElement('progress');
                            div_col.appendChild(receiveProgress);
                          receiveProgress.max = recievedfile.size;
                            div_row.appendChild(div_col);
                            var div_col = document.createElement('div');
                            div_col.className = 'col-xs-3';
                            div_row.appendChild(div_col);
                        }

                }

            });
            presence.enter();
            presence.subscribe(function(member)
            {
                if (member.clientId != ably.auth.tokenDetails.clientId)
                {
                    if (member.action == 'leave')
                    {
                        reset();
                    }
                    else if (member.action == 'enter')
                    {
                    	reset();
                        isInitiatorVideo = true;
                        isInitiatorDataChannel = true;
                        createPeerConnection();
                        activateButtons();
                    }
                }
                else if (member.clientId == ably.auth.tokenDetails.clientId)
                {
                    if (member.action == 'leave')
                    {
                        reset();
                    }
                    else if (member.action == 'enter')
                    {

                        isInitiatorVideo = false;
                        isInitiatorDataChannel = false;
                        createPeerConnection();
                        activateButtons();
                    }
                }
            });

            
            sendMessage({"msg": userName + " has joined the meeting.", 'type': "msg"});
        	container = document.createElement('div');
                container.className = 'peerContainer';
                container.id = 'container_' + userName;

                // show the peer id
                peername = document.createElement('div');
                peername.className = 'peerName';
                peername.appendChild(document.createTextNode('Peer: ' + userName));
                // container.appendChild(peername);

                // show a list of files received / sending
                filelist = document.createElement('ul');
                filelist.className = 'fileList';
                filelist.classList.add('list-unstyled')
                container.appendChild(filelist);

                // show a file select form
                fileinput = document.createElement('input');
                fileinput.type = 'file';
                    shareFileMessage.style.visibility = 'hidden';
                  // enable file sending on connnect
                  if(fileinput)
                  {
                      fileinput.style.disabled = false;
                  }
                fileinput.addEventListener('change', function () {
                    handleFileInputChange();

                }, false);
                    container.appendChild(fileinput);
                fileShareDiv.appendChild(container);

            return;
        }
        

    };
    var handleFileInputChange =  function () {

sentfile = fileinput.files[0];
    if (!sentfile) {
        console.log("empty file");
    } else {
        if (fileinput) fileinput.disabled = true;


                    var div_row = document.createElement('div');
                            div_row.className = 'row';
                    // create a file item
                     sentitem = document.createElement('li');
                    sentitem.className = 'sending';

                    // make a label
        var div_col = document.createElement('div');
                            div_col.className = 'col-xs-3';
                     span = document.createElement('span');
                    span.className = 'filename';
                    span.appendChild(document.createTextNode(sentfile.name));
            div_col.appendChild(span);
            div_row.appendChild(div_col);
                    //                    item.appendChild(span);


                    span = document.createElement('span');
                    span.appendChild(document.createTextNode(sentfile.size + ' bytes'));
                    var div_col = document.createElement('div');
                            div_col.className = 'col-xs-3';
                            div_col.appendChild(span);
                            div_row.appendChild(div_col);
//                            var div_col = document.createElement('div');
//                            div_col.className = 'col-xs-3';
                            div_row.appendChild(div_col);
                    sentitem.appendChild(div_row);
                    filelist.appendChild(sentitem);
                    // create a progress element
        var div_col = document.createElement('div');
                            div_col.className = 'col-xs-3';
                     sendProgress = document.createElement('progress');
                    sendProgress.max = sentfile.size;
                    div_col.appendChild(sendProgress);
                    div_row.appendChild(div_col);
                    var div_col = document.createElement('div');
                            div_col.className = 'col-xs-3';
                            div_row.appendChild(div_col);
        sendMessage({
            "file": true,
            "name": sentfile.name,
            "size": sentfile.size,
            "type": sentfile.type,
            "lastModifiedDate": sentfile.lastModifiedDate
        });
        sleep(1000);
        sendChannel = DataPeerConnection.createDataChannel('sendDataChannel');
        sendChannel.binaryType = 'arraybuffer';
        sendChannel.onopen = onSendChannelStateChange;
        sendChannel.onclose = onSendChannelStateChange;
                          DataPeerConnection.createOffer(setLocalAndSendMessageData, handleCreateOfferError);

    }
};
    var sleep = function (delay) {
        var start = new Date().getTime();
        while (new Date().getTime() < start + delay);
      };
    var handleRemoteScreenStreamAdded = function (event) {
    console.log('Remote screen stream added.');
    var video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.autoplay = true;
    video.srcObject = event.stream;
    video.controls = true;
    video.style.width =  '100%';
    remoteVideoScreenDiv.appendChild(video);
    remoteVideoScreenStream = event.stream;
};

var handleRemoteScreenStreamRemoved = function (event) {
    DataPeerConnection.removeStream(remoteVideoScreenStream);
    remoteVideoScreenStream = null;
    remoteVideoScreenDiv.innerHTML = '';
    console.log('Remote stream removed. Event: ', event);
};
var shareScreen = function()
{
    if (!is_screenshared) {
        getScreenId(function (error, sourceId, screen_constraints) {
    // error    == null || 'permission-denied' || 'not-installed' || 'installed-disabled' || 'not-chrome'
    // sourceId == null || 'string' || 'firefox'

    if(error == 'not-installed') {
     alert('Please install Chrome extension.');
      shareScreenBtn.style.disabled = true;

      return;
    }

    navigator.getUserMedia = navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
    navigator.getUserMedia(screen_constraints, function (stream) {
    localVideoScreenStream = stream;
    var video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.autoplay = true;
    video.srcObject = stream;
    video.controls = true;
    video.style.width =  '100%';
    localVideoScreenDiv.appendChild(video);
    DataPeerConnection.addStream(localVideoScreenStream);
    DataPeerConnection.createOffer(setLocalAndSendMessageData, handleCreateOfferError);
    shareScreenBtn.className = 'pressed';
  shareScreenBtn.innerHTML = '<i class="fa fa-desktop mr-xs"></i> Stop Sharing My Screen';
  is_screenshared = true;
    }, function (error) {
      console.error('getScreenId error', error);

      alert('Failed to capture your screen. Please check Chrome console logs for further information.');
    });
});

    }
    else {
        DataPeerConnection.removeStream(localVideoScreenStream);
    localVideoScreenStream = null;
    localVideoScreenDiv.innerHTML = '';
    DataPeerConnection.createOffer(setLocalAndSendMessageData, handleCreateOfferError);
    shareScreenBtn.className = '';
          shareScreenBtn.innerHTML = '<i class="fa fa-desktop mr-xs"></i> Share My Screen';
          is_screenshared = false;
//    endButtonScreen.classList.add('hidden');

    }
}
    var receiveChannelCallback = function (event) {
    console.log('Receive Channel Callback');
    receiveChannel = event.channel;
    receiveChannel.binaryType = 'arraybuffer';
    receiveChannel.onmessage = onReceiveMessageCallback;
    receiveChannel.onopen = onReceiveChannelStateChange;
    receiveChannel.onclose = onReceiveChannelStateChange;
    receivedSize = 0;
    bitrateMax = 0;
//    downloadAnchor.textContent = '';
//    downloadAnchor.removeAttribute('download');
//    if (downloadAnchor.href) {
//        URL.revokeObjectURL(downloadAnchor.href);
//        downloadAnchor.removeAttribute('href');
//    }
};
var onReceiveMessageCallback =  function (event) {
    // console.log('Received Message ' + event.data.byteLength);
    receiveBuffer.push(event.data);
    receivedSize += event.data.byteLength;

    receiveProgress.value = receivedSize;
    console.log(receivedSize);

    console.log(recievedfile.size);
    if (receivedSize === recievedfile.size) {
        var received = new window.Blob(receiveBuffer);
        receiveBuffer = [];
        var href = document.createElement('a');
          href.href = URL.createObjectURL(received);
          href.download = recievedfile.name;
          href.appendChild(document.createTextNode('download'));
          recieveditem.lastChild.appendChild(href);

        if (statsInterval) {
            window.clearInterval(statsInterval);
            statsInterval = null;
        }
    }
};
var onSendChannelStateChange =function () {
    var readyState = sendChannel.readyState;
    console.log('Send channel state is: ' + readyState);
    if (readyState === 'open') {
        sendData();
    }
};
var sendData = function () {
    var sentfile = fileinput.files[0];
    console.log('File is ' + [sentfile.name, sentfile.size, sentfile.type,
        sentfile.lastModifiedDate
    ].join(' '));
    // Handle 0 size files.
//    statusMessage.textContent = '';
//    downloadAnchor.textContent = '';
    if (sentfile.size === 0) {
//        bitrateDiv.innerHTML = '';
//        statusMessage.textContent = 'File is empty, please select a non-empty file';
        closeDataChannels();
        return;
    }
    sendProgress.max = sentfile.size;
//    receiveProgress.max = sentfile.size;
    var chunkSize = 16384;
    var sliceFile = function(offset) {
        var reader = new window.FileReader();
        reader.onload = (function() {
            return function(e) {
                sendChannel.send(e.target.result);
                if (sentfile.size <= offset + e.target.result.byteLength) {
                    closeDataChannels();
                }
                if (sentfile.size > offset + e.target.result.byteLength) {
                    window.setTimeout(sliceFile, 0, offset + chunkSize);
                }
                sendProgress.value = offset + e.target.result.byteLength;
            };
        })(sentfile);
        var slice = sentfile.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
    };
    sliceFile(0);
};

var onReceiveChannelStateChange = function () {
    var readyState = receiveChannel.readyState;
    console.log('Receive channel state is: ' + readyState);
//    if (readyState === 'open') {
//        timestampStart = (new Date()).getTime();
//        timestampPrev = timestampStart;
//        statsInterval = window.setInterval(displayStats, 500);
//        window.setTimeout(displayStats, 100);
//        window.setTimeout(displayStats, 300);
//    }
};
// display bitrate statistics.
var displayStats = function () {
    var display = function(bitrate) {
        bitrateDiv.innerHTML = '<strong>Current Bitrate:</strong> ' + bitrate + ' kbits/sec';
    };
    if (DataPeerConnection && DataPeerConnection.iceConnectionState === 'connected') {
        if (adapter.browserDetails.browser === 'chrome') {
            // TODO: once https://code.google.com/p/webrtc/issues/detail?id=4321
            // lands those stats should be preferrred over the connection stats.
            DataPeerConnection.getStats(null, function(stats) {
                for (var key in stats) {
                    var res = stats[key];
                    if (timestampPrev === res.timestamp) {
                        return;
                    }
                    if (res.type === 'googCandidatePair' && res.googActiveConnection === 'true') {
                        // calculate current bitrate
                        var bytesNow = res.bytesReceived;
                        var bitrate = Math.round((bytesNow - bytesPrev) * 8 / (res.timestamp - timestampPrev));
                        display(bitrate);
                        timestampPrev = res.timestamp;
                        bytesPrev = bytesNow;
                        if (bitrate > bitrateMax) {
                            bitrateMax = bitrate;
                        }
                    }
                }
            });
        } else {
            // Firefox currently does not have data channel stats. See
            // https://bugzilla.mozilla.org/show_bug.cgi?id=1136832
            // Instead, the bitrate is calculated based on the number of
            // bytes received.
            var bytesNow = receivedSize;
            var now = (new Date()).getTime();
            var bitrate = Math.round((bytesNow - bytesPrev) * 8 / (now - timestampPrev));
            display(bitrate);
            timestampPrev = now;
            bytesPrev = bytesNow;
            if (bitrate > bitrateMax) {
                bitrateMax = bitrate;
            }
        }
    }
};

var closeDataChannels = function () {
    console.log('Closing data channels');
    sentitem.lastChild.appendChild(document.createTextNode('sent'));
    fileinput.style.disabled = false;
};

    startCallBtn.addEventListener("click", startCall);
    endCallBtn.addEventListener("click", endCall);
    muteCallBtn.addEventListener("click", muteCall);
    chatSendBtn.addEventListener("click",sendMessageBtn);
    chatMessageInput.addEventListener("keydown",sendMessageInput);
    shareScreenBtn.addEventListener("click",shareScreen);
    var timer = setInterval(InitiateConnections, 500);
};
