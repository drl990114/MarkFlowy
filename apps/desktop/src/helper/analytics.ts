// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'

export const firebaseAnalyticsInit = () => {
  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
    authDomain: 'markflowy.firebaseapp.com',
    projectId: 'markflowy',
    storageBucket: 'markflowy.appspot.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGINGSENDERID,
    appId: import.meta.env.VITE_FIREBASE_APPID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENTID,
  }

  // Initialize Firebase
  const app = initializeApp(firebaseConfig)
  getAnalytics(app)
}

const umengAnalyticsInit = () => {
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.text = `
    (function(w, d, s, q, i) {
      w[q] = w[q] || [];
      var f = d.getElementsByTagName(s)[0],j = d.createElement(s);
      j.async = true;
      j.id = 'beacon-aplus';
      j.src = 'https://d.alicdn.com/alilog/mlog/aplus/' + i + '.js';
      f.parentNode.insertBefore(j, f);
      })(window, document, 'script', 'aplus_queue', '203467608');

    //集成应用的appKey
    aplus_queue.push({
      action: 'aplus.setMetaInfo',
      arguments: ['appKey', '${import.meta.env.VITE_UMENG_APPKEY}']
    });

    //是否开启调试模式 
    // aplus_queue.push({
    //   action: 'aplus.setMetaInfo',
    //   arguments: ['DEBUG', true]
    // });
`
  document.head.appendChild(script)
}

firebaseAnalyticsInit()
umengAnalyticsInit()
