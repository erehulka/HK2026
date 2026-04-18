import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { mockUploadReceipt } from "@/constants/mock-receipt-upload";

export default function AddReceiptScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  const handleTakePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.7,
      });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
      }
    } catch {
      Alert.alert("Camera error", "Could not take photo.");
    }
  };

  const handleSendToBackend = async () => {
    if (!photoUri || isUploading) return;
    setIsUploading(true);

    try {
      const result = await mockUploadReceipt(photoUri, groupId);
      Alert.alert(
        "Receipt uploaded",
        `Mock backend saved receipt ${result.receiptId}.`
      );
      router.back();
    } catch {
      Alert.alert("Upload failed", "Could not upload receipt.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg items-center justify-center px-5">
        <Text className="text-app-text">Loading camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg px-5 pt-16 gap-4">
        <Text className="text-3xl font-bold text-app-text">Add a receipt</Text>
        <View className="bg-app-surface border border-app-border rounded-xl p-4 gap-3">
          <Text className="text-app-text">
            Camera access is needed to take a receipt photo.
          </Text>
          <Pressable
            onPress={requestPermission}
            className="rounded-[10px] py-3 items-center bg-app-primary"
          >
            <Text className="text-app-text font-semibold">Allow camera</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            className="rounded-[10px] py-3 items-center bg-app-cancel"
          >
            <Text className="text-app-text font-semibold">Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <View className="px-5 pt-16 pb-4 gap-3">
        <Text className="text-3xl font-bold text-app-text">Add a receipt</Text>
        <Text className="text-app-muted">
          Take a photo and send it to backend (mocked for now).
        </Text>
      </View>

      <View className="mx-5 mb-4 rounded-xl overflow-hidden border border-app-border flex-1">
        {!photoUri ? (
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        ) : (
          <View className="flex-1 items-center justify-center bg-app-surface px-5">
            <Text className="text-app-text text-center">
              Photo captured and ready to upload.
            </Text>
            <Text className="text-app-muted text-center mt-2">{photoUri}</Text>
          </View>
        )}
      </View>

      <View className="px-5 pb-6 gap-3">
        {!photoUri ? (
          <Pressable
            onPress={handleTakePhoto}
            className="rounded-[10px] py-3 items-center bg-app-primary"
          >
            <Text className="text-app-text font-semibold">Take photo</Text>
          </Pressable>
        ) : (
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setPhotoUri(null)}
              className="flex-1 rounded-[10px] py-3 items-center bg-app-cancel"
            >
              <Text className="text-app-text font-semibold">Retake</Text>
            </Pressable>
            <Pressable
              onPress={handleSendToBackend}
              disabled={isUploading}
              className={`flex-1 rounded-[10px] py-3 items-center ${
                isUploading ? "bg-app-primary-dim" : "bg-app-primary"
              }`}
            >
              {isUploading ? (
                <ActivityIndicator color="#f4f7ff" />
              ) : (
                <Text className="text-app-text font-semibold">Send</Text>
              )}
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => router.back()}
          className="rounded-[10px] py-3 items-center bg-app-cancel"
        >
          <Text className="text-app-text font-semibold">Close</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
