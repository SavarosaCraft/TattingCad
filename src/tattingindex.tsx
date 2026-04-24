import React, { useState } from 'react';
import './tattingdesigner.css'; // Import CSS for styling

// Import all necessary components and functions
import TattingDesigner from './TattingDesigner';

function App() {
  const [selectedBeadId, setSelectedBeadId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string>('preset_1');
  const [threadPresets, setThreadPresets] = useState([
    { id: 'preset_1', name: 'Default', ds20Working: 3.5, ds20Core: 2.8, picotRegular: 4.5, picotJoined: 6.75 },
    // Add more presets as needed
  ]);

  return (
    <div className="tatting-designer-container">
      {/* Main content of the application */}
      <TattingDesigner
        selectedBeadId={selectedBeadId}
        setSelectedBeadId={setSelectedBeadId}
        activePresetId={activePresetId}
        setActivePresetId={setActivePresetId}
        threadPresets={threadPresets}
        setThreadPresets={setThreadPresets}
      />
    </div>
  );
}

export default App;
