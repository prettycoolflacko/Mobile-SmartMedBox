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

// GANTI INI DENGAN IP VPS ANDA
const API_URL = "http://147.139.136.133:3000/api"; 

export default function HomeScreen() {
  // --- STATE 1: Monitor Data (From VPS/ESP32) ---
  const [monitorData, setMonitorData] = useState<any>(null);
  
  // --- STATE 2: Schedule Data (App Input) ---
  const [schedules, setSchedules] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  
  // --- STATE 3: Form Inputs ---
  const [medName, setMedName] = useState("");
  const [medTime, setMedTime] = useState(""); 
  const [medDesc, setMedDesc] = useState("");
  const [loading, setLoading] = useState(true);

  // ===============================================
  // FUNCTION: Fetch All Data (Polling)
  // ===============================================
  const fetchData = async () => {
    try {
      const response = await fetch(`${API_URL}/data`);
      const data = await response.json();
      
      // Update Sensor Data
      if (data.sensor) {
        setMonitorData({
          temp: data.sensor.temp || 0,
          status: data.sensor.status || "Unknown"
        });
      }

      // Update Schedules
      if (data.schedules) {
        setSchedules(data.schedules);
      }
      setLoading(false);
    } catch (error) {
      console.error("Connection Error:", error);
      // Optional: Don't alert continuously, just log
    }
  };

  // ===============================================
  // EFFECT: Polling Mechanism (Replace Real-time)
  // ===============================================
  useEffect(() => {
    fetchData(); // Fetch immediately
    const interval = setInterval(fetchData, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, []);

  // ===============================================
  // FUNCTION: Add New Schedule
  // ===============================================
  const handleAddSchedule = async () => {
    if (!medName || !medTime) {
      Alert.alert("Error", "Please fill in Name and Time");
      return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(medTime)) {
        Alert.alert("Error", "Time must be in HH:MM format (e.g., 08:30 or 14:00)");
        return;
    }

    try {
      await fetch(`${API_URL}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: medName,
          time: medTime,
          description: medDesc
        })
      });
      
      // Reset Form & Refresh
      setMedName("");
      setMedTime("");
      setMedDesc("");
      setModalVisible(false);
      fetchData(); 
    } catch (e) {
      Alert.alert("Error", "Could not save schedule");
    }
  };

  // ===============================================
  // FUNCTION: Delete Schedule
  // ===============================================
  const handleDelete = async (id: string) => {
    try {
        await fetch(`${API_URL}/schedule/${id}`, {
            method: 'DELETE',
        });
        fetchData();
    } catch (error) {
        Alert.alert("Error", "Could not delete schedule");
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{marginTop: 10}}>Connecting to Server...</Text>
      </View>
    );
  }

  const statusColor = monitorData?.status === "OPEN" ? "#ef5350" : "#66bb6a";

  // --- RENDER COMPONENT (TIDAK ADA PERUBAHAN VISUAL) ---
  return (
    <View style={styles.container}>
      
      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        
        ListHeaderComponent={
          <View>
            <Text style={styles.headerTitle}>Monitor Dashboard</Text>
            
            <View style={styles.monitorRow}>
              {/* Temp Card */}
              <View style={styles.card}>
                <Ionicons name="thermometer-outline" size={32} color="orange" />
                <Text style={styles.cardValue}>{monitorData?.temp?.toFixed(1)}°C</Text>
                <Text style={styles.cardLabel}>Temperature</Text>
              </View>

              {/* Status Card */}
              <View style={[styles.card, { borderColor: statusColor, borderWidth: 2 }]}>
                <Ionicons name={monitorData?.status === "OPEN" ? "lock-open-outline" : "lock-closed-outline"} size={32} color={statusColor} />
                <Text style={[styles.cardValue, { color: statusColor, fontSize: 24 }]}>
                  {monitorData?.status}
                </Text>
                <Text style={styles.cardLabel}>Box Status</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Medicine Schedule</Text>
          </View>
        }

        renderItem={({ item }) => (
          <View style={styles.scheduleItem}>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
            <View style={styles.infoContainer}>
              <Text style={styles.medName}>{item.name}</Text>
              <Text style={styles.medDesc}>{item.description}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={24} color="red" />
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Add Medicine</Text>
          
          <TextInput 
            style={styles.input} 
            placeholder="Medicine Name (e.g. Paracetamol)" 
            value={medName}
            onChangeText={setMedName}
          />
          
          <TextInput 
            style={styles.input} 
            placeholder="Time (HH:MM) 24h format" 
            value={medTime}
            onChangeText={setMedTime}
            keyboardType="numbers-and-punctuation"
          />

          <TextInput 
            style={styles.input} 
            placeholder="Description (e.g. After eating)" 
            value={medDesc}
            onChangeText={setMedDesc}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalVisible(false)}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleAddSchedule}>
              <Text style={styles.btnText}>Save Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// STYLES (SAMA PERSIS DENGAN ORIGINAL)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 50, paddingHorizontal: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  headerTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 25, marginBottom: 15, color: '#333' },

  monitorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { 
    width: '48%', backgroundColor: 'white', padding: 15, borderRadius: 15, 
    alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 
  },
  cardValue: { fontSize: 28, fontWeight: 'bold', marginVertical: 5 },
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

  modalView: {
    flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20
  },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 20, textAlign: 'center' },
  input: {
    backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  btnCancel: { backgroundColor: '#ff5252' },
  btnSave: { backgroundColor: '#4caf50' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});