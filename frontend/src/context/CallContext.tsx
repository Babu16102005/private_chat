import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../services/supabase';
import { messageService, notificationService } from '../services/supabaseService';
import { useAuth } from './AuthContext';
import { configureCallAudioMode, restoreDefaultAudioMode, startCallTone, stopCallTone } from '../utils/callAudio';
import { buildCallSignalPayload, getCallSignalType, getCallTargetId } from '../utils/callSignaling';

let RTCPeerConnectionImpl: any;
let RTCIceCandidateImpl: any;
let RTCSessionDescriptionImpl: any;
let mediaDevicesImpl: any;
let MediaStreamImpl: any;
const isExpoGo = Constants.appOwnership === 'expo';

if (Platform.OS === 'web') {
  RTCPeerConnectionImpl = globalThis.RTCPeerConnection;
  RTCIceCandidateImpl = globalThis.RTCIceCandidate;
  RTCSessionDescriptionImpl = globalThis.RTCSessionDescription;
  mediaDevicesImpl = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  MediaStreamImpl = globalThis.MediaStream;
} else if (!isExpoGo) {
  try {
    const webrtc = require('react-native-webrtc');
    RTCPeerConnectionImpl = webrtc.RTCPeerConnection;
    RTCIceCandidateImpl = webrtc.RTCIceCandidate;
    RTCSessionDescriptionImpl = webrtc.RTCSessionDescription;
    mediaDevicesImpl = webrtc.mediaDevices;
    MediaStreamImpl = webrtc.MediaStream;
  } catch (e) {
    console.warn(
      'WebRTC native module not found. Calls require a custom dev build. Run `npx expo run:android`.'
    );
  }
} else {
  console.warn('Running in Expo Go. WebRTC calling is disabled until you use a custom dev build.');
}

type CallState = 'IDLE' | 'RINGING' | 'CONNECTED' | 'REJECTED' | 'ENDED';

interface CallContextType {
  localStream: any;
  remoteStream: any;
  callState: CallState;
  isIncoming: boolean;
  partnerInfo: any;
  isVideoCall: boolean;
  initiateCall: (pairId: string, partner: any, isVideo: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleVideoMode: () => Promise<void>;
  isMuted: boolean;
  isCameraOff: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const fallbackIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const buildStaticIceServers = () => {
  const iceServers: any[] = [
    ...fallbackIceServers,
  ];
  const turnUrl = process.env.EXPO_PUBLIC_TURN_URL;
  const turnUsername = process.env.EXPO_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.EXPO_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl.split(',').map((url: string) => url.trim()).filter(Boolean),
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return iceServers;
};

const fetchMeteredIceServers = async () => {
  const meteredUrl = process.env.EXPO_PUBLIC_METERED_TURN_URL;
  const meteredApiKey = process.env.EXPO_PUBLIC_METERED_TURN_API_KEY;

  if (!meteredUrl || !meteredApiKey) return null;

  const url = `${meteredUrl.replace(/\/$/, '')}/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredApiKey)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Metered TURN credentials failed with status ${response.status}`);
  }

  const iceServers = await response.json();
  return Array.isArray(iceServers) && iceServers.length > 0 ? iceServers : null;
};

const getIceServers = async () => {
  try {
    const meteredIceServers = await fetchMeteredIceServers();
    if (meteredIceServers) {
      return meteredIceServers;
    }
  } catch (error) {
    console.warn('Failed to fetch Metered TURN credentials, using static ICE config:', error);
  }

  return buildStaticIceServers();
};

const buildPeerConnectionConfiguration = async () => ({
  iceServers: await getIceServers(),
  iceCandidatePoolSize: 10,
  iceTransportPolicy: process.env.EXPO_PUBLIC_FORCE_TURN === 'true' ? 'relay' : 'all',
});

const ICE_RESTART_LIMIT = 1;
const LOW_BANDWIDTH_VIDEO_CONSTRAINTS = {
  width: { ideal: 640, max: 960 },
  height: { ideal: 360, max: 540 },
  frameRate: { ideal: 18, max: 24 },
};

const callLog = (message: string, details?: Record<string, any>) => {
  if (__DEV__) {
    console.log(`[Call] ${message}`, details || '');
  }
};

const ensureAndroidMediaPermissions = async (wantsVideo: boolean) => {
  if (Platform.OS !== 'android') return;

  const permissions = [
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ...(wantsVideo ? [PermissionsAndroid.PERMISSIONS.CAMERA] : []),
  ];

  const statuses = await PermissionsAndroid.requestMultiple(permissions);
  const denied = permissions.filter((permission) => statuses[permission] !== PermissionsAndroid.RESULTS.GRANTED);

  if (denied.length > 0) {
    throw Object.assign(new Error('Camera or microphone permission was denied'), { name: 'PermissionDeniedError' });
  }
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [callState, setCallState] = useState<CallState>('IDLE');
  const [isIncoming, setIsIncoming] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [remoteSdp, setRemoteSdp] = useState<any>(null);
  const [partnerTargetId, setPartnerTargetId] = useState<string | null>(null);

  const pc = useRef<any>(null);
  const inboundChannel = useRef<any>(null);
  const outboundChannel = useRef<any>(null);
  const callStateRef = useRef<CallState>('IDLE');
  const pendingIceCandidates = useRef<any[]>([]);
  const iceRestartCount = useRef(0);
  const callStartedAtRef = useRef<string | null>(null);
  const activePairIdRef = useRef<string | null>(null);
  const isVideoCallRef = useRef(false);
  const callLoggedRef = useRef(false);

  useEffect(() => {
    callStateRef.current = callState;
    if (callState === 'CONNECTED' && !callStartedAtRef.current) {
      callStartedAtRef.current = new Date().toISOString();
    }
  }, [callState]);

  useEffect(() => {
    activePairIdRef.current = activePairId;
  }, [activePairId]);

  useEffect(() => {
    isVideoCallRef.current = isVideoCall;
  }, [isVideoCall]);

  const removeChannel = useCallback((channelRef: React.MutableRefObject<any>) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const resetCallState = useCallback(() => {
    if (pc.current) {
      try {
        if (pc.current.connectionState !== 'closed') {
          pc.current.close();
        }
      } catch (e) {
        console.warn('Error closing peer connection:', e);
      }
      pc.current = null;
    }

    removeChannel(outboundChannel);
    stopCallTone();
    restoreDefaultAudioMode().catch((error) => console.warn('Failed to restore audio mode:', error));

    // Clear pending ICE candidates queue
    pendingIceCandidates.current = [];
    iceRestartCount.current = 0;
    callStartedAtRef.current = null;
    callLoggedRef.current = false;

    setRemoteSdp(null);
    setRemoteStream(null);
    setCallState('IDLE');
    setIsIncoming(false);
    setPartnerInfo(null);
    setPartnerTargetId(null);
    setActivePairId(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsVideoCall(false);

    setLocalStream((currentStream: any) => {
      if (currentStream) {
        try {
          currentStream.getTracks().forEach((track: any) => {
            try {
              track.stop();
            } catch (e) {
              console.warn('Error stopping track:', e);
            }
          });
        } catch (e) {
          console.warn('Error stopping media tracks:', e);
        }
      }
      return null;
    });
  }, [removeChannel]);

  const logCallHistory = useCallback(async (status: 'completed' | 'missed' | 'rejected' | 'cancelled') => {
    const pairId = activePairIdRef.current;
    if (!pairId || callLoggedRef.current) return;
    callLoggedRef.current = true;

    try {
      const endedAt = new Date().toISOString();
      const startedAt = callStartedAtRef.current;
      await messageService.sendCallHistoryMessage(pairId, {
        callKind: isVideoCallRef.current ? 'video' : 'audio',
        callStatus: status,
        callStartedAt: startedAt || endedAt,
        callEndedAt: endedAt,
      });
    } catch (error) {
      console.warn('Failed to write call history:', error);
    }
  }, []);

  const tuneVideoSenderForLowBandwidth = useCallback(async () => {
    try {
      const senders = pc.current?.getSenders?.() || [];
      const videoSender = senders.find((sender: any) => sender.track?.kind === 'video');
      if (!videoSender?.getParameters || !videoSender?.setParameters) return;

      const params = videoSender.getParameters() || {};
      params.encodings = params.encodings?.length ? params.encodings : [{}];
      params.encodings[0] = {
        ...params.encodings[0],
        maxBitrate: 450000,
        maxFramerate: 20,
        scaleResolutionDownBy: 1.5,
      };
      await videoSender.setParameters(params);
    } catch (error) {
      console.warn('Could not tune video bitrate:', error);
    }
  }, []);

  const ensureOutboundChannel = useCallback((targetUserId: string) => {
    removeChannel(outboundChannel);

    const channel = supabase.channel(`calls:${targetUserId}`);
    outboundChannel.current = channel;
    callLog('subscribing outbound channel', { targetUserId });
    
    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Channel subscription timeout'));
      }, 5000);

      channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          callLog('outbound channel ready', { targetUserId });
          resolve(channel);
        } else if (status === 'CHANNEL_ERROR') {
          clearTimeout(timeout);
          reject(new Error('Channel subscription failed'));
        }
      });
    });
  }, [removeChannel]);

  const sendSignal = useCallback(async (event: string, payload: Record<string, any> = {}) => {
    if (!outboundChannel.current) {
      throw new Error('Call signaling channel is not ready');
    }

    const result: any = await outboundChannel.current.send({
      type: 'broadcast',
      event,
      payload: buildCallSignalPayload(event as any, payload),
    });

    callLog('signal sent', { event, result });

    if (result === 'error' || result?.error) {
      throw new Error('Call signaling message failed to send');
    }
  }, []);

  const cleanup = useCallback(() => {
    resetCallState();
  }, [resetCallState]);

  useEffect(() => {
    if (!user) return;

    const globalChannel = supabase.channel(`calls:${user.id}`)
      .on('broadcast', { event: '*' }, async ({ event, payload }: any) => {
        if (!payload) return;

        const eventType = getCallSignalType(event, payload);

        switch (eventType) {
          case 'call-offer':
            if (payload.senderInfo?.id === user.id) return;
            if (callStateRef.current !== 'IDLE') return;

            setPartnerInfo(payload.senderInfo);
            setPartnerTargetId(payload.senderInfo?.id || null);
            setActivePairId(payload.pairId);
            setRemoteSdp(payload.sdp);
            setIsIncoming(true);
            setIsVideoCall(!!payload.isVideo);
            setIsCameraOff(!payload.isVideo);
            setCallState('RINGING');
            configureCallAudioMode(!!payload.isVideo).catch((error) => console.warn('Failed to configure call audio:', error));
            startCallTone('ringtone');
            break;

          case 'ice-candidate':
            if (!payload.candidate) return;
            try {
              if (pc.current?.remoteDescription) {
                await pc.current.addIceCandidate(new RTCIceCandidateImpl(payload.candidate));
              } else {
                pendingIceCandidates.current.push(payload.candidate);
              }
            } catch (error) {
              console.error('Failed to add ICE candidate:', error);
            }
            break;

          case 'call-answer':
            if (!pc.current || !payload.sdp) return;
            try {
              await pc.current.setRemoteDescription(new RTCSessionDescriptionImpl(payload.sdp));
              
              // Drain pending ICE candidates after remote description is set
              while (pendingIceCandidates.current.length > 0) {
                const candidate = pendingIceCandidates.current.shift();
                try {
                  await pc.current.addIceCandidate(new RTCIceCandidateImpl(candidate));
                } catch (error) {
                  console.error('Failed to add queued ICE candidate:', error);
                }
              }
              
              setCallState('CONNECTED');
              stopCallTone();
            } catch (error) {
              console.error('Failed to set remote answer:', error);
            }
            break;

          case 'call-hangup':
            cleanup();
            break;

          default:
            break;
        }
      })
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Call channel disconnected — will attempt auto-reconnect...');
        }
      });

    inboundChannel.current = globalChannel;

    return () => {
      supabase.removeChannel(globalChannel);
      inboundChannel.current = null;
      cleanup();
    };
  }, [cleanup, user]);

  const setupPeerConnection = useCallback(async (partnerId: string, wantsVideo: boolean) => {
    if (!RTCPeerConnectionImpl || !mediaDevicesImpl?.getUserMedia) {
      throw new Error('WebRTC is not available on this device');
    }

    if (pc.current) {
      pc.current.close();
    }

    await ensureOutboundChannel(partnerId);

    const peerConfiguration = await buildPeerConnectionConfiguration();
    pc.current = new RTCPeerConnectionImpl(peerConfiguration);
    callLog('ice server configuration', {
      iceServerCount: peerConfiguration.iceServers.length,
      hasTurn: peerConfiguration.iceServers.some((server: any) => String(server.urls).includes('turn:')),
      iceTransportPolicy: peerConfiguration.iceTransportPolicy,
    });
    callLog('peer connection created', { partnerId, wantsVideo });

    pc.current.onicecandidate = async (event: any) => {
      if (!event.candidate) return;

      try {
        await sendSignal('ice-candidate', { candidate: event.candidate });
      } catch (error) {
        console.error('Failed to send ICE candidate:', error);
      }
    };

    pc.current.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        callLog('remote stream received', { trackKind: event.track?.kind });
        setRemoteStream(event.streams[0]);
        return;
      }

      if (MediaStreamImpl && event.track) {
        setRemoteStream((currentStream: any) => {
          const stream = currentStream || new MediaStreamImpl();
          stream.addTrack(event.track);
          return stream;
        });
      }
    };

    pc.current.onconnectionstatechange = () => {
      const state = pc.current?.connectionState;
      callLog('peer connection state changed', { state });
      if (state === 'connected') {
        stopCallTone();
        setCallState('CONNECTED');
      }
      if (state === 'failed') {
        if (callStateRef.current !== 'IDLE') {
          cleanup();
        }
      }
    };

    pc.current.oniceconnectionstatechange = () => {
      const state = pc.current?.iceConnectionState;
      callLog('ice connection state changed', { state });
      if (state === 'failed') {
        if (iceRestartCount.current < ICE_RESTART_LIMIT && pc.current?.restartIce) {
          iceRestartCount.current += 1;
          callLog('restarting ICE', { attempt: iceRestartCount.current });
          pc.current.restartIce();
          return;
        }

        if (callStateRef.current !== 'IDLE') {
          cleanup();
        }
      }
    };

    let stream;
    try {
      await ensureAndroidMediaPermissions(wantsVideo);
      stream = await mediaDevicesImpl.getUserMedia({
        audio: true,
        video: wantsVideo ? LOW_BANDWIDTH_VIDEO_CONSTRAINTS : false,
      });
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        Alert.alert(
          'Permission Required',
          'Please grant camera and microphone permissions to make calls. Check your browser or device settings.'
        );
      } else if (error.name === 'NotFoundError') {
        Alert.alert(
          'Device Not Found',
          'No camera or microphone found. Please connect a device and try again.'
        );
      } else {
        Alert.alert(
          'Media Access Failed',
          'Could not access camera or microphone. Please check your device settings.'
        );
      }
      throw error;
    }

    setLocalStream((currentStream: any) => {
      if (currentStream) {
        currentStream.getTracks().forEach((track: any) => track.stop());
      }
      return stream;
    });

    setIsCameraOff(!wantsVideo);
    stream.getTracks().forEach((track: any) => pc.current?.addTrack(track, stream));
    if (wantsVideo) tuneVideoSenderForLowBandwidth();
  }, [cleanup, ensureOutboundChannel, sendSignal, tuneVideoSenderForLowBandwidth]);

  const initiateCall = async (pairId: string, partner: any, isVideo: boolean) => {
    try {
      if (!user) return;
      const targetUserId = getCallTargetId(partner);

      if (!targetUserId || targetUserId === user.id) {
        throw new Error('Could not find your partner account for the call. Please reopen the chat and try again.');
      }

      setPartnerInfo(partner);
      setPartnerTargetId(targetUserId);
      setActivePairId(pairId);
      setCallState('RINGING');
      setIsIncoming(false);
      setIsVideoCall(isVideo);
      setRemoteSdp(null);
      await configureCallAudioMode(isVideo);

      callLog('starting call', { pairId, targetUserId, isVideo });
      await setupPeerConnection(targetUserId, isVideo);

      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);

      await sendSignal('call-offer', {
        sdp: offer,
        senderInfo: {
          id: user.id,
          name: user.email?.split('@')[0],
          email: user.email,
        },
        pairId,
        isVideo,
      });
      notificationService.sendCallPush(pairId, targetUserId, isVideo);
      startCallTone('ringback');
    } catch (error: any) {
      console.error('Call start failed:', error);
      const msg = error?.message || 'Could not start the call.';
      if (msg.includes('WebRTC is not available')) {
        Alert.alert('Call feature unavailable',
          'Video/audio calls require a custom dev build with native modules.\n\n' +
          'Expo Go can use chat features, but calling needs: npx expo run:android\n\n' +
          'Alternatively, install a preview build via EAS.');
        } else {
          Alert.alert('Call failed', msg);
        }
      cleanup();
    }
  };

  const acceptCall = async () => {
    try {
      const targetUserId = partnerTargetId || getCallTargetId(partnerInfo);
      if (!partnerInfo || !activePairId || !remoteSdp || !targetUserId) return;

      callLog('accepting call', { activePairId, targetUserId });
      stopCallTone();
      await configureCallAudioMode(isVideoCall);
      await setupPeerConnection(targetUserId, isVideoCall);

      await pc.current.setRemoteDescription(new RTCSessionDescriptionImpl(remoteSdp));
      
      // Drain pending ICE candidates after remote description is set
      while (pendingIceCandidates.current.length > 0) {
        const candidate = pendingIceCandidates.current.shift();
        try {
          await pc.current.addIceCandidate(new RTCIceCandidateImpl(candidate));
        } catch (error) {
          console.error('Failed to add queued ICE candidate:', error);
        }
      }
      
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);

      await sendSignal('call-answer', { sdp: answer });
      stopCallTone();
      setCallState('CONNECTED');
      callStartedAtRef.current = new Date().toISOString();
    } catch (error: any) {
      console.error('Call accept failed:', error);
      Alert.alert('Call failed', error?.message || 'Could not answer the call.');
      cleanup();
    }
  };

  const rejectCall = async () => {
    const targetUserId = partnerTargetId || getCallTargetId(partnerInfo);
    if (targetUserId) {
      try {
        await ensureOutboundChannel(targetUserId);
        await sendSignal('call-hangup', { reason: 'rejected' });
      } catch (error) {
        console.error('Failed to reject call:', error);
      }
    }
    await logCallHistory('rejected');
    cleanup();
  };

  const endCall = async () => {
    const targetUserId = partnerTargetId || getCallTargetId(partnerInfo);
    if (targetUserId) {
      try {
        await ensureOutboundChannel(targetUserId);
        await sendSignal('call-hangup', { reason: 'ended' });
      } catch (error) {
        console.error('Failed to end call:', error);
      }
    }
    await logCallHistory(callStateRef.current === 'CONNECTED' ? 'completed' : 'cancelled');
    cleanup();
  };

  const toggleMute = () => {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) return;
    
    audioTracks.forEach((track: any) => track.enabled = !track.enabled);
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) return;
    
    videoTracks.forEach((track: any) => track.enabled = !track.enabled);
    setIsCameraOff(!isCameraOff);
  };

  const replaceVideoTrack = async (nextTrack: any, stream: any) => {
    const sender = pc.current?.getSenders?.().find((item: any) => item.track?.kind === 'video');
    if (sender?.replaceTrack) {
      await sender.replaceTrack(nextTrack);
    } else if (nextTrack) {
      pc.current?.addTrack(nextTrack, stream);
    }
  };

  const toggleVideoMode = async () => {
    if (!pc.current || !mediaDevicesImpl?.getUserMedia) return;

    if (isVideoCall) {
      const videoTracks = localStream?.getVideoTracks?.() || [];
      for (const track of videoTracks) {
        track.enabled = false;
        track.stop?.();
        await replaceVideoTrack(null, localStream);
      }
      setIsVideoCall(false);
      setIsCameraOff(true);
      return;
    }

    try {
      await ensureAndroidMediaPermissions(true);
      const videoStream = await mediaDevicesImpl.getUserMedia({ audio: false, video: LOW_BANDWIDTH_VIDEO_CONSTRAINTS });
      const [videoTrack] = videoStream.getVideoTracks();
      if (!videoTrack) return;

      await replaceVideoTrack(videoTrack, videoStream);
      setLocalStream((currentStream: any) => {
        if (!currentStream) return videoStream;
        currentStream.addTrack(videoTrack);
        return currentStream;
      });
      setIsVideoCall(true);
      setIsCameraOff(false);
      tuneVideoSenderForLowBandwidth();
    } catch (error) {
      console.error('Switch to video failed:', error);
      Alert.alert('Camera unavailable', 'Could not turn on video for this call.');
    }
  };

  return (
    <CallContext.Provider value={{
      localStream,
      remoteStream,
      callState,
      isIncoming,
      partnerInfo,
      isVideoCall,
      initiateCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleCamera,
      toggleVideoMode,
      isMuted,
      isCameraOff
    }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};
