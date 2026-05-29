import { useState } from 'react';
import { Button, Dialog } from 'zens';

export default () => {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Dialog
        title="标题"
        open={open}
        onClose={() => setOpen(false)}
      >
        <div>内容</div>
      </Dialog>
      <Button onClick={() => setOpen(true)}>打开</Button>
    </div>
  );
};
