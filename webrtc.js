'use strict';
var WebrtcConnection = function(userName, channelName, pcConfig, startCallBtn, endCallBtn, muteCallBtn, localVideoDiv, remoteVideoDiv,
        callType) {

    // Accessible to functions because the functions are closures.
    var userName = userName;
    var channelName = channelName;
    var pcConfig = pcConfig;
    var isInitiatorVideo = false;
    var isInitiatorDataChannel = false;
    var localVideoStream = undefined;
    var remoteVideoStream = undefined;
    var localVideoDiv = localVideoDiv;
    var remoteVideoDiv = remoteVideoDiv;
    var VideoPeerConnection = undefined;
    var DataPeerConnection = undefined;
    var presence = undefined;
    var channel = undefined;
    var ably = new Ably.Realtime(
        {
            authUrl: '/auth/api/' + channelName
        });
    // console.log(ably);
    // var timer = setInterval(InitiateConnections, 500);
    var callType = callType;
    var callMute = false;
    var startCallBtn = startCallBtn;
    var endCallBtn = endCallBtn;
    startCallBtn.disabled = false;
    startCallBtn.style.visibility = 'visible';
    endCallBtn.disabled = true;
    endCallBtn.style.visibility = 'hidden';
    var muteCallBtn = muteCallBtn;
    muteCallBtn.disabled = true;
    muteCallBtn.style.visibility = 'hidden';
    sendMessage = function (message) {
        message['userName'] = userName;
        channel.publish(channelName, JSON.stringify(message));
        console.log('Message Sent on Channel' + channelName);
    };
    createPeerConnection = function () {
        try {
            VideoPeerConnection = new RTCPeerConnection(pcConfig);
            console.log('Video PeerConnection Created Successfully');
            VideoPeerConnection.onicecandidate = handleIceCandidate;
            VideoPeerConnection.onaddstream = handleRemoteStreamAdded;
            VideoPeerConnection.onremovestream = handleRemoteStreamRemoved;
            if (isInitiatorVideo) {
                VideoPeerConnection.createOffer(setLocalAndSendMessage, handleCreateOfferError);
            }
        }
        catch (e) {
            console.log('Failed to create Video PeerConnection, exception: ' + e.message);
        }
        try {
            DataPeerConnection = new RTCPeerConnection(pcConfig);
            console.log('Data PeerConnection Created Successfully');
            DataPeerConnection.onicecandidate = handleIceCandidateData;
            if (isInitiatorDataChannel) {
                DataPeerConnection.createOffer(setLocalAndSendMessageData, handleCreateOfferError);
            }
        }
        catch (e) {
            console.log('Failed to create Video PeerConnection, exception: ' + e.message);
        }
    };
    InitiateConnections = function () {
        console.log(this);
        if (ably && ably.auth && ably.auth.tokenDetails) {
            clearInterval(timer);
            channel = ably.channels.get(channelName);
            presence = channel.presence;
            channel.subscribe(channelName, function (message) {
                message.data = JSON.parse(message.data);
                if (message.data.userName == userName) {
                    return
                }
                if (message.data.type === 'offer') {
                    if (message.data.isDataChannel) {
                        DataPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    else {
                        VideoPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    doAnswer(message.data.isDataChannel);
                }
                else if (message.data.type === 'answer') {
                    if (message.data.isDataChannel) {
                        DataPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    else {
                        VideoPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                }
                else if (message.data.type === 'candidate') {
                    if (message.data.isDataChannel) {
                        var candidate = new RTCIceCandidate(
                            {
                                sdpMLineIndex: message.data.label,
                                candidate: message.data.candidate
                            });
                        DataPeerConnection.addIceCandidate(candidate);
                    }
                    else {
                        var candidate = new RTCIceCandidate(
                            {
                                sdpMLineIndex: message.data.label,
                                candidate: message.data.candidate
                            });
                        VideoPeerConnection.addIceCandidate(candidate);
                    }
                }
            });
            presence.enter();
            presence.subscribe(function (member) {
                if (member.clientId != ably.auth.tokenDetails.clientId) {
                    if (member.action == 'leave') {
                        reset();
                    }
                    else if (member.action == 'enter') {
                        isInitiatorVideo = true;
                        isInitiatorDataChannel = true;
                        createPeerConnection();
                    }
                }
                else if (member.clientId == ably.auth.tokenDetails.clientId) {
                    if (member.action == 'leave') {
                        reset();
                    }
                    else if (member.action == 'enter') {
                        isInitiatorVideo = false;
                        isInitiatorDataChannel = false;
                        createPeerConnection();
                    }
                }
            });
            activateButtons();
            return;
        }


    };
    activateButtons = function () {
        startCallBtn.addEventListener("click", startCall);
        startCallBtn.disabled = true;
        startCallBtn.style.visibility = 'hidden';
        endCallBtn.addEventListener("click", endCall);
        endCallBtn.disabled = false;
        endCallBtn.style.visibility = 'visible';
    };
    startCall = function () {
        if (callType == 'video') {
            navigator.mediaDevices.getUserMedia(
                {
                    audio: !callMute,
                    video: true
                }).then(gotStream).catch(function (e) {
                alert('getUserMedia() error: ' + e.name);
            });
        }
        else(callType == 'audio')
        {
            navigator.mediaDevices.getUserMedia(
                {
                    audio: !callMute,
                    video: false
                }).then(gotStream).catch(function (e) {
                alert('getUserMedia() error: ' + e.name);
            });
        }
    };
    gotStream = function (stream) {
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
        muteCallBtn.addEventListener("click", muteCall);
        muteCallBtn.disabled = false;
        muteCallBtn.style.visibility = 'visible';
    };
    handleIceCandidateData = function (event) {
        if (event.candidate) {
            sendMessage(
                {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate,
                    isDataChannel: true
                });
        }
        else {
            console.log('End of candidates.');
        }
    };
    handleIceCandidate = function (event) {
        console.log('icecandidate event: ', event);
        if (event.candidate) {
            sendMessage(
                {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate,
                    isDataChannel: false
                });
        }
        else {
            console.log('End of candidates.');
        }
    };
    handleCreateOfferError = function (event) {
        console.log('createOffer() error: ', event);
    };
    doAnswer = function (isDataChannel) {
        if (isDataChannel) {
            DataPeerConnection.createAnswer().then(setLocalAndSendMessageData, onCreateSessionDescriptionError);
        }
        else {
            VideoPeerConnection.createAnswer().then(setLocalAndSendMessage, onCreateSessionDescriptionError);
        }
    };
    setLocalAndSendMessage = function (sessionDescription) {
        VideoPeerConnection.setLocalDescription(sessionDescription);
        sendMessage(
            {
                type: sessionDescription.type,
                sdp: sessionDescription.sdp,
                isDataChannel: false
            });
    };
    setLocalAndSendMessageData = function (sessionDescription) {
        DataPeerConnection.setLocalDescription(sessionDescription);
        sendMessage(
            {
                type: sessionDescription.type,
                sdp: sessionDescription.sdp,
                isDataChannel: true
            });
    };
    onCreateSessionDescriptionError = function (error) {
    };
    handleRemoteStreamAdded = function (event) {
        remoteVideoStream = event.stream;
        var video = document.createElement("video");
        video.setAttribute("playsinline", "");
        video.autoplay = true;
        video.srcObject = event.stream;
        video.controls = true;
        video.style.width = '100%';
        remoteVideoDiv.appendChild(video);
    };
    handleRemoteStreamRemoved = function (event) {
        VideoPeerConnection.removeStream(remoteVideoStream);
        remoteVideoStream = null;
        remoteVideoDiv.innerHTML = '';
    };
    muteCall = function () {
        if (!callMute) {
            var audioTracks = VideoPeerConnection.getLocalStreams()[0].getAudioTracks();
            if (audioTracks.length !== 0) {
                for (var i = 0; i < audioTracks.length; ++i) {
                    audioTracks[i].enabled = !call_mute;
                }
            }
            callMute = !callMute;
            muteCallBtn.innerHTML = 'Mute';
        }
        else {
            var audioTracks = VideoPeerConnection.getLocalStreams()[0].getAudioTracks();
            if (audioTracks.length !== 0) {
                for (var i = 0; i < audioTracks.length; ++i) {
                    audioTracks[i].enabled = !call_mute;
                }
            }
            callMute = !callMute;
            muteCallBtn.innerHTML = 'Muted';
        }
    };
    endCall = function () {
        VideoPeerConnection.removeStream(localVideoStream);
        localVideoStream = null;
        localVideoDiv.innerHTML = '';
        VideoPeerConnection.createOffer(setLocalAndSendMessage, handleCreateOfferError);
        startCallBtn.disabled = false;
        startCallBtn.style.visibility = 'visible';
        endCallBtn.disabled = true;
        endCallBtn.style.visibility = 'hidden';
        muteCallBtn.disabled = true;
        muteCallBtn.style.visibility = 'hidden';
    };
    reset = function () {
        VideoPeerConnection.close();
        VideoPeerConnection = null;
        isInitiatorVideo = false;
        DataPeerConnection.close();
        DataPeerConnection = null;
        isInitiatorDataChannel = false;
    };
    var timer = setInterval(InitiateConnections, 500);
};
