import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'viewclaw_api_baseurl';

export default function App() {
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:8787');
  const [draft, setDraft] = useState('http://127.0.0.1:8787');
  const [tasks, setTasks] = useState([]);

  const load = async () => {
    const url = await AsyncStorage.getItem(KEY);
    if (url) {
      setBaseUrl(url);
      setDraft(url);
    }
  };

  const fetchTasks = async (url = baseUrl) => {
    try {
      const res = await fetch(`${url}/api/tasks`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setTasks([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    fetchTasks();
    const timer = setInterval(() => fetchTasks(), 5000);
    return () => clearInterval(timer);
  }, [baseUrl]);

  const saveUrl = async () => {
    const v = draft.trim().replace(/\/+$/, '');
    await AsyncStorage.setItem(KEY, v);
    setBaseUrl(v);
    fetchTasks(v);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b1020', padding: 16 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 10 }}>viewClaw</Text>
      <Text style={{ color: '#9ca3af', marginBottom: 8 }}>API BaseURL（持久化）</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        style={{ backgroundColor: '#11182d', color: '#fff', padding: 12, borderRadius: 8 }}
      />
      <TouchableOpacity onPress={saveUrl} style={{ marginTop: 8, backgroundColor: '#2563eb', padding: 10, borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>保存并连接</Text>
      </TouchableOpacity>

      <Text style={{ color: '#9ca3af', marginVertical: 10 }}>当前：{baseUrl}</Text>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: '#1b2540', padding: 10, borderRadius: 8, marginBottom: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: '#cbd5e1' }}>状态：{item.status}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
