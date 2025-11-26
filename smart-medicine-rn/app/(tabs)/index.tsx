import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList, Modal,
  RefreshControl // Added Pull-to-Refresh
  ,


  StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// ✅ FINAL HTTPS URL
const API_URL = "https://flacko.fyuko.dev/api";

// 🔔 Notification Config
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
}); 

export default function HomeScreen() {
  const [monitorData, setMonitorData] = useState<any>({ temp: 0, status: "Unknown" });
  const [schedules, setSchedules] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState("--:--");
  const [refreshing, setRefreshing] = useState(false); // For pull-to-refresh
  
  // Inputs
  const [medName, setMedName] = useState("");
  const [medTime, setMedTime] = useState(""); 
  const [medDesc, setMedDesc] = useState("");
  const [loading, setLoading] = useState(true);

  // Refs for anti-spam
  const lastHighTempNotif = useRef<number>(0);
  const lastLateNotif = useRef<number>(0);

  // --- 1. FETCH DATA ---
  const fetchData = async () => {
    try {
      // Add timestamp to prevent caching
      const response = await fetch(`${API_URL}/data?t=${Date.now()}`);
      const data = await response.json();
      
      if (data.sensor) {
        setMonitorData({
          temp: data.sensor.temp || 0,
          status: data.sensor.status || "Unknown"
        });
      }
      if (data.schedules) {
        setSchedules(data.schedules);
      }
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.log("Network error (polling)");
      setRefreshing(false);
    }
  };

  // --- 2. PERMISSIONS ---
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        // Optional: Alert user only once
        console.log("Notification permission denied");
      }
    })();
  }, []);

  // --- 3. CLOCK ---
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
      setCurrentTime(timeString);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- 4. POLLING INTERVAL ---
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // Polling every 2s is enough for HTTPS
    return () => clearInterval(interval);
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  // --- CRUD FUNCTIONS ---
  const handleAddSchedule = async () => {
    if (!medName || !medTime) return Alert.alert("Error", "Fill Name & Time");
    
    // Validasi format jam sederhana
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(medTime)) {
       return Alert.alert("Error", "Format Time must be HH:MM");
    }

    await fetch(`${API_URL}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: medName, time: medTime, description: medDesc })
    });
    setMedName(""); setMedTime(""); setMedDesc(""); setModalVisible(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/schedule/${id}`, { method: 'DELETE' });
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{marginTop: 10}}>Connecting to Server...</Text>
      </View>
    );
  }

  // --- LOGIC RULES ---
  const isHighTemp = monitorData.temp > 40;
  // Late Logic: Current Time == Schedule Time AND Box is CLOSED
  const isTimeForMeds = schedules.some(s => s.time === currentTime);
  const isLate = isTimeForMeds && monitorData.status === "CLOSED";
  const isOpen = monitorData.status === "OPEN";

  // --- NOTIFICATIONS ---
  const now = Date.now();
  if (isHighTemp && (now - lastHighTempNotif.current) > 300000) { // 5 min cooldown
    Notifications.scheduleNotificationAsync({
      content: { title: "🔥 OVERHEAT!", body: `Temp is ${monitorData.temp.toFixed(1)}°C!`, sound: true },
      trigger: null,
    });
    lastHighTempNotif.current = now;
  }
  if (isLate && (now - lastLateNotif.current) > 300000) {
    const med = schedules.find(s => s.time === currentTime);
    Notifications.scheduleNotificationAsync({
      content: { title: "💊 Time for Meds!", body: `Take ${med?.name || 'medicine'} now!`, sound: true },
      trigger: null,
    });
    lastLateNotif.current = now;
  }

  // Status Styling
  let statusColor = "#66bb6a"; 
  let statusText = monitorData.status;
  if (isHighTemp) { statusColor = "#b71c1c"; statusText = "OVERHEAT"; } 
  else if (isOpen) { statusColor = "#ef5350"; } 
  else if (isLate) { statusColor = "#ff9800"; statusText = "TAKE MEDS"; }

  return (
    <View style={styles.container}>
      
      {/* ALERTS */}
      {isHighTemp && (
        <View style={[styles.warningBanner, { backgroundColor: '#d32f2f' }]}>
          <Ionicons name="thermometer" size={28} color="white" />
          <Text style={styles.warningText}>HIGH TEMPERATURE ALERT!</Text>
        </View>
      )}
      {isLate && !isHighTemp && (
        <View style={[styles.warningBanner, { backgroundColor: '#ff9800' }]}>
          <Ionicons name="alarm" size={28} color="white" />
          <Text style={styles.warningText}>MEDICINE TIME!</Text>
        </View>
      )}

      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        
        ListHeaderComponent={
          <View>
            <Text style={styles.headerTitle}>Smart Medicine Box</Text>
            <View style={styles.monitorRow}>
              {/* Temp Card */}
              <View style={[styles.card, isHighTemp && { borderColor: 'red', borderWidth: 2 }]}>
                <Ionicons name="thermometer-outline" size={32} color={isHighTemp ? "red" : "orange"} />
                <Text style={styles.cardValue}>{monitorData?.temp?.toFixed(1)}°C</Text>
                <Text style={styles.cardLabel}>Temperature</Text>
              </View>
              {/* Status Card */}
              <View style={[styles.card, { borderColor: statusColor, borderWidth: 2 }]}>
                <Ionicons name={isOpen ? "lock-open-outline" : "lock-closed-outline"} size={32} color={statusColor} />
                <Text style={[styles.cardValue, { color: statusColor, fontSize: 20 }]}>{statusText}</Text>
                <Text style={styles.cardLabel}>Box Status</Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>Daily Schedules</Text>
          </View>
        }
        
        renderItem={({ item }) => {
          const isCurrentSchedule = item.time === currentTime;
          return (
            <View style={[styles.scheduleItem, isCurrentSchedule && { borderColor: '#ff9800', borderWidth: 2 }]}>
              <View style={[styles.timeContainer, isCurrentSchedule && { backgroundColor: '#ff9800' }]}>
                <Text style={[styles.timeText, isCurrentSchedule && { color: 'white' }]}>{item.time}</Text>
              </View>
              <View style={styles.infoContainer}>
                <Text style={styles.medName}>{item.name}</Text>
                <Text style={styles.medDesc}>{item.description}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={24} color="#ef5350" />
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalView}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="calendar-outline" size={32} color="#2196F3" />
              <Text style={styles.modalTitle}>Add New Schedule</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Medicine Name</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. Paracetamol, Vitamin C" 
                placeholderTextColor="#999"
                value={medName} 
                onChangeText={setMedName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Time</Text>
              <TextInput 
                style={styles.input} 
                placeholder="08:30" 
                placeholderTextColor="#999"
                value={medTime} 
                onChangeText={setMedTime} 
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <Text style={styles.formatHint}>Format: HH:MM (24-hour)</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. After breakfast, With water" 
                placeholderTextColor="#999"
                value={medDesc} 
                onChangeText={setMedDesc}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={20} color="white" style={{marginRight: 5}} />
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleAddSchedule}>
                <Ionicons name="checkmark-circle-outline" size={20} color="white" style={{marginRight: 5}} />
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: 50, paddingHorizontal: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '800', marginBottom: 20, color: '#1a1a1a' },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: 25, marginBottom: 15, color: '#1a1a1a' },
  warningBanner: { padding: 15, borderRadius: 12, marginBottom: 20, flexDirection: 'row', alignItems: 'center', elevation: 4 },
  warningText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  monitorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: 'white', padding: 15, borderRadius: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  cardValue: { fontSize: 24, fontWeight: '800', marginVertical: 8 },
  cardLabel: { fontSize: 12, color: '#888', fontWeight: '600', textTransform: 'uppercase' },
  scheduleItem: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 12, elevation: 1 },
  timeContainer: { backgroundColor: '#e3f2fd', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginRight: 15 },
  timeText: { fontSize: 16, fontWeight: '800', color: '#1976D2' },
  infoContainer: { flex: 1 },
  medName: { fontSize: 16, fontWeight: '700', color: '#333' },
  medDesc: { fontSize: 13, color: '#666' },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: '#2196F3', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  modalView: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 25, elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginLeft: 10 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#f5f5f5', padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0', color: '#333' },
  formatHint: { fontSize: 12, color: '#666', marginTop: 6, fontStyle: 'italic', textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', elevation: 3 },
  btnCancel: { backgroundColor: '#ef5350' },
  btnSave: { backgroundColor: '#66bb6a' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});