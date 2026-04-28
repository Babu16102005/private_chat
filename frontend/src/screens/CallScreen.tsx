import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import { Phone, PhoneOff, Mic, MicOff, Camera, CameraOff } from 'lucide-react-native';
import { useCall } from '../context/CallContext';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

let RTCView: any;
const isExpoGo = Constants.appOwnership === 'expo';

if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    const webrtc = require('react-native-webrtc');
    RTCView = webrtc.RTCView;
  } catch (e) { console.warn('WebRTC native module not found'); }
}

const { width, height } = Dimensions.get('window');

const WebVideo = ({ stream, muted, style }: { stream: MediaStream; muted?: boolean; style: any }) => {
  const videoRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !videoRef.current) return;

    videoRef.current.srcObject = stream;
    videoRef.current.muted = !!muted;

    const playVideo = async () => {
      try {
        await videoRef.current.play();
      } catch (error) {
        console.warn('Video autoplay prevented:', error);
      }
    };

    playVideo();
  }, [muted, stream]);

  if (Platform.OS !== 'web') return null;

  return <video ref={videoRef} autoPlay playsInline muted={muted} style={StyleSheet.flatten(style)} />;
};

const WebAudio = ({ stream }: { stream: MediaStream }) => {
  const audioRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !audioRef.current) return;

    audioRef.current.srcObject = stream;

    const playAudio = async () => {
      try {
        await audioRef.current.play();
      } catch (error) {
        console.warn('Audio autoplay prevented:', error);
      }
    };

    playAudio();
  }, [stream]);

  if (Platform.OS !== 'web') return null;

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
};

export const CallScreen = () => {
  const { 
    localStream, 
    remoteStream, 
    callState, 
    isIncoming, 
    partnerInfo, 
    isVideoCall,
    acceptCall, 
    rejectCall, 
    endCall, 
    toggleMute, 
    toggleCamera,
    isMuted,
    isCameraOff 
  } = useCall();
  const { colors, isDark } = useTheme();

  if (callState === 'IDLE') return null;

  const renderVideo = (stream: any, style: any, mirror: boolean = false, muted: boolean = false) => {
    if (!stream) return null;

    if (Platform.OS === 'web') {
      return <WebVideo stream={stream} muted={muted} style={[style, mirror ? styles.mirroredVideo : null]} />;
    }

    if (!RTCView) return null;

    return (
      <RTCView
        streamURL={stream.toURL()}
        style={style}
        objectFit="cover"
        mirror={mirror}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Remote Video (Full Screen) */}
      {Platform.OS === 'web' && remoteStream && !isVideoCall && <WebAudio stream={remoteStream} />}
      {remoteStream && isVideoCall ? (
        renderVideo(remoteStream, styles.remoteVideo)
      ) : (
        <LinearGradient colors={colors.gradientPrimary as any} style={styles.remotePlaceholder}>
          <Image
            source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${partnerInfo?.name || 'Partner'}` }}
            style={styles.remoteAvatar}
          />
          <Text style={[styles.remoteName, { color: 'white' }]}>
            {partnerInfo?.name || 'Partner'}
          </Text>
          <Text style={[styles.statusText, { color: 'white' }]}>
            {callState === 'RINGING' ? (isIncoming ? 'Incoming Call...' : 'Calling...') : 'Connected'}
          </Text>
        </LinearGradient>
      )}

      {/* Local Video (PiP) */}
      {localStream && isVideoCall && (
        <View style={[styles.localVideoWrap, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}>
          {renderVideo(localStream, styles.localVideo, true, true)}
        </View>
      )}

      {/* Controls Overlay */}
      <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={styles.controlsOverlay}>
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={toggleMute} style={[styles.controlBtn, { backgroundColor: isMuted ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }]}>
            {isMuted ? <MicOff color="white" size={26} /> : <Mic color="white" size={26} />}
          </TouchableOpacity>

          {callState === 'RINGING' && isIncoming ? (
            <>
              <TouchableOpacity onPress={rejectCall} style={[styles.controlBtn, styles.endCallBtn]}>
                <PhoneOff color="white" size={26} />
              </TouchableOpacity>
              <TouchableOpacity onPress={acceptCall} style={[styles.controlBtn, styles.acceptCallBtn]}>
                <Phone color="white" size={26} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={endCall} style={[styles.controlBtn, styles.endCallBtn]}>
              <PhoneOff color="white" size={26} />
            </TouchableOpacity>
          )}

          {isVideoCall && (
            <TouchableOpacity onPress={toggleCamera} style={[styles.controlBtn, { backgroundColor: isCameraOff ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }]}> 
              {isCameraOff ? <CameraOff color="white" size={26} /> : <Camera color="white" size={26} />}
            </TouchableOpacity>
          )}
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    ...StyleSheet.absoluteFillObject, 
    zIndex: 1000, 
    backgroundColor: '#000' 
  },
  remoteVideo: { flex: 1 },
  mirroredVideo: { transform: [{ scaleX: -1 }] },
  remotePlaceholder: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: height * 0.1
  },
  remoteAvatar: { 
    width: 140, 
    height: 140, 
    borderRadius: 70, 
    marginBottom: 20 
  },
  remoteName: { 
    fontSize: 28, 
    fontWeight: '800', 
    marginBottom: 8 
  },
  statusText: { 
    fontSize: 16, 
    fontWeight: '600', 
    opacity: 0.8 
  },
  localVideoWrap: { 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 60 : 40, 
    right: 20, 
    width: 120, 
    height: 180, 
    borderRadius: 20, 
    overflow: 'hidden', 
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  localVideo: { flex: 1 },
  controlsOverlay: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    height: 180, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden'
  },
  controlsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 30 
  },
  controlBtn: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  endCallBtn: { backgroundColor: '#FF4B4B' },
  acceptCallBtn: { backgroundColor: '#10B981' }
});
