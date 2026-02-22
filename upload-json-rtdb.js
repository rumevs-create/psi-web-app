// upload-json-rtdb.js
// Script untuk upload JSON ke Firebase RTDB tanpa overwrite existing data
// Cara pakai: node upload-json-rtdb.js <path_json_file> <database_path>
// Contoh: node upload-json-rtdb.js equipment.json /equipment

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 🔥 KONFIGURASI - Ganti dengan service account key Anda
const serviceAccount = require('./serviceAccountKey.json');

const firebaseConfig = {
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://psi-management-system-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase Admin
admin.initializeApp(firebaseConfig);
const db = admin.database();

// Parse command line arguments
const jsonFile = process.argv[2];
const dbPath = process.argv[3] || '/';

if (!jsonFile) {
  console.error('❌ Error: File JSON tidak ditentukan');
  console.log('Penggunaan: node upload-json-rtdb.js <file.json> [database_path]');
  console.log('Contoh:');
  console.log('  node upload-json-rtdb.js equipment.json /equipment');
  console.log('  node upload-json-rtdb.js pressure_vessel.json /pressure_vessel');
  process.exit(1);
}

// Baca file JSON
let jsonData;
try {
  const fileContent = fs.readFileSync(path.resolve(jsonFile), 'utf8');
  jsonData = JSON.parse(fileContent);
  console.log(`✅ File ${jsonFile} berhasil dibaca`);
} catch (error) {
  console.error(`❌ Error membaca file: ${error.message}`);
  process.exit(1);
}

// Fungsi untuk merge data (tidak overwrite)
async function mergeDataToRTDB(data, targetPath) {
  try {
    const ref = db.ref(targetPath);
    
    // Ambil existing data
    const snapshot = await ref.once('value');
    const existingData = snapshot.val() || {};
    
    console.log(`📊 Existing data di ${targetPath}:`, Object.keys(existingData).length, 'keys');
    
    // Merge data: existing + new (new tidak overwrite existing kecuali level leaf)
    const mergedData = { ...existingData };
    
    // Recursive merge untuk nested objects
    function deepMerge(target, source) {
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            // Jika object, recursive merge
            target[key] = target[key] || {};
            deepMerge(target[key], source[key]);
          } else {
            // Leaf node, overwrite
            target[key] = source[key];
          }
        }
      }
    }
    
    deepMerge(mergedData, data);
    
    // Hitung perubahan
    const newKeys = Object.keys(data);
    const existingKeys = Object.keys(existingData);
    const addedKeys = newKeys.filter(k => !existingKeys.includes(k));
    const updatedKeys = newKeys.filter(k => existingKeys.includes(k));
    
    console.log(`📈 Akan menambahkan ${addedKeys.length} keys baru`);
    console.log(`📝 Akan mengupdate ${updatedKeys.length} keys existing`);
    if (addedKeys.length > 0) console.log('   Keys baru:', addedKeys.join(', '));
    
    // Simpan merged data
    await ref.set(mergedData);
    
    console.log(`✅ SUCCESS: Data berhasil di-merge ke ${targetPath}`);
    console.log(`📊 Total keys sekarang:`, Object.keys(mergedData).length);
    
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    throw error;
  }
}

// Fungsi untuk update spesifik (tidak hapus existing)
async function updateDataToRTDB(data, targetPath) {
  try {
    const ref = db.ref(targetPath);
    
    // Gunakan update() untuk tidak overwrite sibling nodes
    await ref.update(data);
    
    console.log(`✅ SUCCESS: Data berhasil di-update ke ${targetPath}`);
    console.log(`📊 Keys diupdate:`, Object.keys(data).length);
    
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('🔥 FIREBASE RTDB JSON UPLOAD TOOL');
  console.log('='.repeat(60));
  console.log(`📁 File: ${jsonFile}`);
  console.log(`🎯 Target Path: ${dbPath}`);
  console.log('='.repeat(60));
  
  try {
    // Pilih mode: 'merge' atau 'update'
    // 'merge' = recursive merge (default, lebih aman)
    // 'update' = flat update (hanya 1 level)
    const mode = process.argv[4] || 'merge';
    
    if (mode === 'update') {
      await updateDataToRTDB(jsonData, dbPath);
    } else {
      await mergeDataToRTDB(jsonData, dbPath);
    }
    
    console.log('='.repeat(60));
    console.log('🎉 SELESAI!');
    console.log('='.repeat(60));
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Gagal:', error.message);
    process.exit(1);
  }
}

// Jalankan
main();