import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Releases } from './pages/Releases';
import { Editor, TemplateEditor } from './editor';
import { AdminLayout } from './pages/admin/AdminLayout';
import { WorkflowManagement } from './pages/admin/WorkflowManagement';
import { TemplateManagement } from './pages/admin/TemplateManagement';
import { AgentProvider, AgentDock } from './agent';

function App() {
  return (
    <AgentProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/releases" element={<Releases />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/workflows" replace />} />
          <Route path="workflows" element={<WorkflowManagement />} />
          <Route path="templates" element={<TemplateManagement />} />
        </Route>
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/:workflowCode" element={<Editor />} />
        <Route path="/template-editor/:templateCode" element={<TemplateEditor />} />
      </Routes>
      <AgentDock />
    </AgentProvider>
  );
}

export default App;
