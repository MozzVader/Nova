// Firebase configuration
// Replace these values with your own Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCTWw9olvBAcNo1CfbAbvX6KeIuHOGaRuE",
  authDomain: "nova-4b689.firebaseapp.com",
  projectId: "nova-4b689",
  storageBucket: "nova-4b689.firebasestorage.app",
  messagingSenderId: "702429573137",
  appId: "1:702429573137:web:7aa477ade020e1785d01b0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistence failed: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistence not available in this browser');
  }
});
