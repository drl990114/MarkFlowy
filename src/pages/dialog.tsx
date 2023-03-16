import { Button } from "@mui/material";
import { ask } from "@tauri-apps/api/dialog";
const Dialog = () => {
  const yes = async () => {
    await ask("Are you sure?", "Tauri");
  };
  const yes2 = async () => {
    await ask("This action cannot be reverted. Are you sure?", {
      title: "Tauri",
      type: "warning",
    });
  };
  return (
    <>
      <Button variant="contained" color="secondary" onClick={yes}>
        Test
      </Button>

      <Button variant="contained" color="secondary" onClick={yes2}>
        Test2
      </Button>
    </>
  );
};
export default Dialog;
