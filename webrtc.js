'use strict';
var WebrtcConnection = function(userName, channelName, pcConfig, startCallBtn, endCallBtn, muteCallBtn, localVideoDiv,
    remoteVideoDiv, callType)
{
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
    var ably = new Ably.Realtime({authUrl: '/auth/api/' + channelName});
    var callType = callType;
    var callMute = false;
    var startCallBtn = startCallBtn;
    var endCallBtn = endCallBtn;
    startCallBtn.disabled = true;
    startCallBtn.style.visibility = 'visible';
    endCallBtn.disabled = true;
    endCallBtn.style.visibility = 'hidden';

    var muteCallBtn = muteCallBtn;
    muteCallBtn.disabled = true;
    muteCallBtn.style.visibility = 'hidden';
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
    var InitiateConnections = function()
    {
        if (ably && ably.auth && ably.auth.tokenDetails)
        {
            clearInterval(timer);
            console.log(ably.auth.tokenDetails);
            channel = ably.channels.get(channelName);
            presence = channel.presence;
            channel.subscribe(channelName, function(message)
            {
                message.data = JSON.parse(message.data);
                if (message.data.userName == userName)
                {
                    return
                }
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
                    activateButtons();
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
                    activateButtons();
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
                        isInitiatorVideo = true;
                        isInitiatorDataChannel = true;
                        createPeerConnection();
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
                    }
                }
            });

        }
        return;
    };
    var activateButtons = function()
    {

        startCallBtn.disabled = false;
        startCallBtn.style.visibility = 'visible';
        endCallBtn.disabled = true;
        endCallBtn.style.visibility = 'hidden';
    };
    var startCall = function()
    {
        if (callType == 'video')
        {
            navigator.mediaDevices.getUserMedia(
            {
                audio: !callMute,
                video: true
            }).then(gotStream).catch(function(e)
            {
                alert('getUserMedia() error: ' + e.name);
            });
        }
        else(callType == 'audio')
        {
            navigator.mediaDevices.getUserMedia(
            {
                audio: !callMute,
                video: false
            }).then(gotStream).catch(function(e)
            {
                alert('getUserMedia() error: ' + e.name);
            });
        }
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
    var doAnswer = function(isDataChannel)
    {
        if (isDataChannel)
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
        localVideoStream = null;
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
        VideoPeerConnection = null;
        isInitiatorVideo = false;
        console.log('VideoPeerConnection is closed.');
        DataPeerConnection.close();
        DataPeerConnection = null;
        isInitiatorDataChannel = false;
        console.log('DataPeerConnection is closed.');
    };
    startCallBtn.addEventListener("click", startCall);
    endCallBtn.addEventListener("click", endCall);
    muteCallBtn.addEventListener("click", muteCall);
    var timer = setInterval(InitiateConnections, 500);
};
