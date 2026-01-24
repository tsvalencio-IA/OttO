/* =================================================================
   FIREBASE CORE INTEGRATION
   Handles Auth & Realtime Database for Leaderboards
   ================================================================= */

window.CoreFB = {
    app: null,
    db: null,
    auth: null,
    user: null,

    init: async function() {
        // Configuração segura (fallback se variaveis de ambiente falharem)
        const firebaseConfig = {
  apiKey: "AIzaSyB0ThqhfK6xc8P1D4WCkavhdXbb7zIaQJk",
  authDomain: "thiaguinhowii.firebaseapp.com",
  databaseURL: "https://thiaguinhowii-default-rtdb.firebaseio.com",
  projectId: "thiaguinhowii",
  storageBucket: "thiaguinhowii.firebasestorage.app",
  messagingSenderId: "63695043126",
  appId: "1:63695043126:web:abd6a8ba7792313991b697"
};

        if(window.FB) {
            try {
                this.app = window.FB.initializeApp(firebaseConfig);
                this.db = window.FB.getDatabase(this.app);
                this.auth = window.FB.getAuth(this.app);
                
                // Anonymous Login
                const userCred = await window.FB.signInAnonymously(this.auth);
                this.user = userCred.user;
                console.log("Firebase Auth: OK", this.user.uid);
                return true;
            } catch(e) {
                console.warn("Firebase Init Failed (Offline Mode):", e);
                return false;
            }
        }
    },

    saveScore: function(name, time, score) {
        if(!this.db || !this.user) return;
        const scoreRef = window.FB.ref(this.db, 'leaderboard');
        const newScoreRef = window.FB.push(scoreRef);
        window.FB.set(newScoreRef, {
            name: name,
            time: time,
            score: score,
            uid: this.user.uid,
            timestamp: Date.now()
        });
    },

    getLeaderboard: function(callback) {
        if(!this.db) return;
        const q = window.FB.query(window.FB.ref(this.db, 'leaderboard'), window.FB.orderByChild('score'), window.FB.limitToLast(10));
        window.FB.onValue(q, (snapshot) => {
            const data = [];
            snapshot.forEach((child) => { data.push(child.val()); });
            callback(data.reverse());
        });
    }
};