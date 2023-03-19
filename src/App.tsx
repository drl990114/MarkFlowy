import { Editor } from '@toast-ui/react-editor';
import { Explorer } from "@components";
import '@toast-ui/editor/dist/toastui-editor.css';

const App = () => {
  const content = [
    '# Markdown Editor!',
    '',
  ].join('\n');

  return (
    <div style={{ height: '100vh' }}>
      <Explorer />
      <Editor previewStyle="vertical" initialValue={content} height="100%"/>
    </div>
  );
};

export default App;
