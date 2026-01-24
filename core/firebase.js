/* =================================================================
   FIREBASE CORE INTEGRATION (STANDALONE MODULE)
   Handles Auth & Realtime Database for Leaderboards
   Project: ThiaguinhoWii
   ================================================================= */

// Importação direta dos módulos (CDN) - Essencial para funcionar sem bundler (Webpack/Vite)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

window.CoreFB = {
    app: null,
    db: null,
    auth: null,
    user: null,

    // SUAS CHAVES REAIS CONFIGURADAS AQUI
    config: {
        apiKey: "AIzaSyB0ThqhfK6xc8P1D4WCkavhdXbb7zIaQJk",
        authDomain: "thiaguinhowii.firebaseapp.com",
        databaseURL: "https://thiaguinhowii-default-rtdb.firebaseio.com",
        projectId: "thiaguinhowii",
        storageBucket: "thiaguinhowii.firebasestorage.app",
        messagingSenderId: "63695043126",
        appId: "1:63695043126:web:abd6a8ba7792313991b697"
    },

    init: async function() {
        console.log("🔥 Inicializando Firebase...");
        
        try {
            // 1. Inicializa a Aplicação
            this.app = initializeApp(this.config);
            
            // 2. Inicializa Serviços
            this.db = getDatabase(this.app);
            this.auth = getAuth(this.app);
            
            // 3. Autenticação Anônima (Necessária para leitura/escrita segura)
            const userCred = await signInAnonymously(this.auth);
            this.user = userCred.user;
            
            console.log("✅ Firebase Conectado! UID:", this.user.uid);
            return true;

        } catch(e) {
            console.error("❌ Falha crítica no Firebase:", e);
            console.warn("⚠️ O jogo rodará em modo OFFLINE. O Ranking não será salvo.");
            return false;
        }
    },

    // Salvar Pontuação
    saveScore: function(name, time, score) {
        if(!this.db || !this.user) {
            console.warn("Tentativa de salvar score falhou: Firebase offline.");
            return;
        }

        const scoreRef = ref(this.db, 'leaderboard');
        const newScoreRef = push(scoreRef);
        
        set(newScoreRef, {
            name: name.toUpperCase().substring(0, 12), // Limite de caracteres para segurança UI
            time: time,
            score: parseInt(score),
            uid: this.user.uid,
            timestamp: Date.now()
        }).then(() => {
            console.log("🏆 Score salvo no servidor!");
        }).catch((err) => {
            console.error("Erro ao salvar score:", err);
        });
    },

    // Ler Ranking (Top 10)
    getLeaderboard: function(callback) {
        if(!this.db) return;
        
        // Query para pegar os últimos 10 baseados no score (Firebase ordena ascendente)
        const q = query(ref(this.db, 'leaderboard'), orderByChild('score'), limitToLast(10));
        
        onValue(q, (snapshot) => {
            const data = [];
            snapshot.forEach((child) => {
                data.push(child.val());
            });
            // Inverte o array para mostrar o maior score primeiro (Descendente)
            callback(data.reverse());
        });
    }
};