import { Button, Space, toast } from 'zens';

export default () => {
  const normalToast = () => {
    toast('normal toast');
  };

  const errorToast = () => {
    toast.error('error toast');
  };

  const longtextToast = () => {
    toast('longtext toast'.repeat(20), {
      duration: 10000,
    });
  };

  const successToast = () => {
    toast.success('success toast');
  };

  const promiseToast = () => {
    let a = 'qweq';
    const n = toast.loading('loading');

    setTimeout(() => {
      toast.dismiss(n);
      toast.success('success', {
        action: {
          label: 'action',
          onClick: () => {
            toast('action');
          },
        },
      });
    }, 2000);
  };

  return (
    <Space>
      <Button onClick={normalToast}>toast</Button>
      <Button onClick={errorToast}>error toast</Button>
      <Button onClick={longtextToast}>longtext</Button>
      <Button onClick={successToast}>success toast</Button>
      <Button onClick={promiseToast}>promise toast</Button>
    </Space>
  );
};
