import { Routes, Route } from "react-router-dom";
import Dialog from "./pages/dialog";
import { Button } from "@mui/material";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/api/notification";
import { invoke } from "@tauri-apps/api";
const App = () => {
  const send = async () => {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === "granted";
    }
    if (permissionGranted) {
      sendNotification("Hello world");
      sendNotification({ title: "TAURI", body: "Tauri is awesome!" });
    }
  };
  const inv = () => {
    invoke("greet", { name: "world" }).then((resp) => {
      console.log(resp);
      // sendNotification(resp)
    });
  };
  return (
    <div>
      <Button variant="contained" color="primary"onClick={send}>Send</Button>
      <Button onClick={inv}>Invoke</Button>
    </div>
  );
};
export default App;
