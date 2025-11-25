import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList, Modal,
  StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// GANTI DENGAN DOMAIN HTTPS ANDA
const API_URL = "https://flacko.fyuko.dev/api"; 

export default function HomeScreen() {
  // --- STATE ---
  const [monitorData, setMonitorData] = useState<any>({ temp: 0, status: "Unknown" });
  const [schedules, setSchedules] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState("--:--");
  
  // Form Inputs
  const [medName, setMedName] = useState("");
  const [medTime, setMedTime] = useState(""); 
  const [medDesc, setMedDesc] = useState("");
  const [loading, setLoading] = useState(true);

  // ===============================================
  // 1. POLLING DATA (Anti-Cache)
  // ===============================================
  const fetchData = async () => {
    try {
      // Trik ?t=... agar Android selalu ambil data baru
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
    } catch (error) {
      console.log("Network error (polling)");
    }
  };

  // ===============================================
  // 2. JAM DIGITAL (Untuk Cek Telat Minum Obat)
  // ===============================================
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      // Format HH:MM
      const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
      setCurrentTime(timeString);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ===============================================
  // 3. INTERVAL UTAMA
  // ===============================================
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000); // Update tiap 1 detik
    return () => clearInterval(interval);
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
      </View>
    );
  }

  // ===============================================
  // LOGIKA WARNING (RULES)
  // ===============================================
  
  // RULE 1: HIGH TEMP (> 40°C)
  const isHighTemp = monitorData.temp > 40;

  // RULE 2: MISSED SCHEDULE (Cek Jam HP vs Jadwal vs Status Box)
  // Jika jam sekarang ada di daftar jadwal DAN box masih TERTUTUP
  const isTimeForMeds = schedules.some(s => s.time === currentTime);
  const isLate = isTimeForMeds && monitorData.status === "CLOSED";
  
  const isOpen = monitorData.status === "OPEN";

  // Tentukan Warna Status
  let statusColor = "#66bb6a"; // Hijau (Normal)
  let statusText = monitorData.status;

  if (isHighTemp) {
      statusColor = "#b71c1c"; // Merah Gelap (Bahaya)
      statusText = "OVERHEAT";
  } else if (isOpen) {
      statusColor = "#ef5350"; // Merah (Terbuka)
  } else if (isLate) {
      statusColor = "#ff9800"; // Oranye (Waktunya Minum)
      statusText = "TIME TO TAKE";
  }

  return (
    <View style={styles.container}>
      
      {/* --- BANNER PERINGATAN --- */}
      
      {/* 1. WARNING SUHU TINGGI */}
      {isHighTemp && (
        <View style={[styles.warningBanner, { backgroundColor: '#d32f2f' }]}>
          <Ionicons name="thermometer" size={28} color="white" />
          <View style={{marginLeft: 10}}>
            <Text style={styles.warningTitle}>TEMPERATURE WARNING!</Text>
            <Text style={styles.warningText}>Box is too hot ({monitorData.temp.toFixed(1)}°C)</Text>
          </View>
        </View>
      )}

      {/* 2. WARNING JADWAL MINUM OBAT */}
      {isLate && !isHighTemp && (
        <View style={[styles.warningBanner, { backgroundColor: '#ff9800' }]}>
          <Ionicons name="alarm" size={28} color="white" />
          <View style={{marginLeft: 10}}>
            <Text style={styles.warningTitle}>MEDICINE TIME!</Text>
            <Text style={styles.warningText}>Please open the box now.</Text>
          </View>
        </View>
      )}

      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        
        // HEADER DASHBOARD
        ListHeaderComponent={
          <View>
            <Text style={styles.headerTitle}>Smart Box Monitor</Text>
            
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
                <Text style={[styles.cardValue, { color: statusColor, fontSize: 22 }]}>
                  {statusText}
                </Text>
                <Text style={styles.cardLabel}>Current Status</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Medicine Schedule</Text>
          </View>
        }
        
        // LIST JADWAL
        renderItem={({ item }) => {
          // Highlight jadwal yang sedang aktif (sesuai jam sekarang)
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
                <Ionicons name="trash-outline" size={24} color="red" />
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* TOMBOL TAMBAH (+ FAB) */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* POPUP TAMBAH JADWAL */}
      <Modal
        animationType="slide" transparent={true} visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Add Schedule</Text>
          
          <TextInput style={styles.input} placeholder="Medicine Name" value={medName} onChangeText={setMedName}/>
          <TextInput style={styles.input} placeholder="Time (HH:MM)" value={medTime} onChangeText={setMedTime} keyboardType="numbers-and-punctuation"/>
          <TextInput style={styles.input} placeholder="Description (e.g. After meal)" value={medDesc} onChangeText={setMedDesc}/>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalVisible(false)}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleAddSchedule}>
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 50, paddingHorizontal: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 25, marginBottom: 15, color: '#333' },
  
  // Warning Banners (Rules Logic)
  warningBanner: {
    padding: 15, borderRadius: 10, marginBottom: 20,
    flexDirection: 'row', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3
  },
  warningTitle: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  warningText: { color: 'white', fontSize: 14 },

  monitorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { 
    width: '48%', backgroundColor: 'white', padding: 15, borderRadius: 15, 
    alignItems: 'center', elevation: 3 
  },
  cardValue: { fontSize: 24, fontWeight: 'bold', marginVertical: 5 },
  cardLabel: { fontSize: 14, color: 'gray' },

  scheduleItem: {
    backgroundColor: 'white', flexDirection: 'row', alignItems: 'center',
    padding: 15, borderRadius: 12, marginBottom: 10, elevation: 2
  },
  timeContainer: { backgroundColor: '#e3f2fd', padding: 10, borderRadius: 8, marginRight: 15 },
  timeText: { fontSize: 18, fontWeight: 'bold', color: '#1976D2' },
  infoContainer: { flex: 1 },
  medName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  medDesc: { fontSize: 14, color: 'gray' },

  fab: {
    position: 'absolute', bottom: 30, right: 30,
    backgroundColor: '#2196F3', width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center', elevation: 5
  },
  modalView: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  btnCancel: { backgroundColor: '#ff5252' },
  btnSave: { backgroundColor: '#4caf50' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});