import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Releases } from './pages/Releases';
import { Editor, TemplateEditor } from './editor';
import { AdminLayout } from './pages/admin/AdminLayout';
import { WorkflowManagement } from './pages/admin/WorkflowManagement';
import { TemplateManagement } from './pages/admin/TemplateManagement';
import { AgentConfigManagement } from './pages/admin/AgentConfigManagement';
import { SessionReview } from './pages/admin/SessionReview';
import { AgentProvider, AgentDock } from './agent';

function App() {
  return (
    <AgentProvider>
      <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/releases" element={<Releases />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/workflows" replace />} />
              <Route path="workflows" element={<WorkflowManagement />} />
              <Route path="templates" element={<TemplateManagement />} />
              <Route path="agent-config" element={<AgentConfigManagement />} />
              <Route path="sessions" element={<SessionReview />} />
            </Route>
            <Route path="/editor" element={<Editor />} />
            <Route path="/editor/:workflowCode" element={<Editor />} />
            <Route path="/template-editor/:templateCode" element={<TemplateEditor />} />
          </Routes>
        </div>
        <AgentDock />
      </div>
    </AgentProvider>
  );
}

export default App;
