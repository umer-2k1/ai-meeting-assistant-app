import RootProvider from './components/providers/root';
import MeetingCopilotApp from './features/meeting-copilot/meeting-copilot-app';

function App() {
  return (
    <RootProvider>
      <MeetingCopilotApp />
    </RootProvider>
  );
}

export default App;
