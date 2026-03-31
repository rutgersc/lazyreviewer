import { TextAttributes } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import type { ParsedKey } from '@opentui/core';
import { Effect } from 'effect';
import { ENV_CREDENTIALS, ensureEnvFile, getEnvFilePath, type MissingCredential } from '../config/dotenv-config';
import { openFileInEditor } from '../utils/open-file';
import { runWithAppServices } from '../appLayerRuntime';
import { useState } from 'react';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { Colors } from '../colors';

interface ConfigurationPageProps {
  missingCredentials: MissingCredential[];
  onClose: () => void;
}

const openEnvFile = async () => {
  await Effect.runPromise(ensureEnvFile());
  await runWithAppServices(openFileInEditor('.env'));
};

export default function ConfigurationPage({ missingCredentials, onClose }: ConfigurationPageProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const envPath = getEnvFilePath();

  const configured = ENV_CREDENTIALS.length - missingCredentials.length;
  const missingKeys = new Set(missingCredentials.map(c => c.key));

  const handleClick = useDoubleClick<number>({
    onSingleClick: (index) => setSelectedIndex(index),
    onDoubleClick: () => openEnvFile(),
  });

  useKeyboard((key: ParsedKey) => {
    if (key.name === 'escape' || key.name === 'q') {
      onClose();
    } else if (key.name === 'up' || key.name === 'k') {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.name === 'down' || key.name === 'j') {
      setSelectedIndex(prev => Math.min(ENV_CREDENTIALS.length - 1, prev + 1));
    } else if (key.name === 'return' || key.name === 'e') {
      openEnvFile();
    }
  });

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: Colors.BACKGROUND,
        zIndex: 2000,
        flexDirection: 'column',
      }}
    >
      <box style={{ paddingLeft: 1, paddingRight: 1, border: true, borderColor: Colors.DIM }}>
        <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode="none">
          Configuration  ({configured}/{ENV_CREDENTIALS.length} configured)
        </text>
      </box>

      <box style={{ flexDirection: 'column', paddingLeft: 1, paddingRight: 1, flexGrow: 1, overflow: 'hidden' }}>
        {ENV_CREDENTIALS.map((credential, index) => {
          const isSelected = selectedIndex === index;
          const isMissing = missingKeys.has(credential.key);

          return (
            <box
              key={credential.key}
              onMouseDown={() => handleClick(index)}
              style={{
                flexDirection: 'row',
                backgroundColor: isSelected ? Colors.TRACK : 'transparent',
              }}
            >
              <text style={{ fg: isMissing ? Colors.ERROR : Colors.SUCCESS }} wrapMode="none">
                {isMissing ? ' x ' : ' v '}
              </text>
              <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode="none">
                {credential.key}
              </text>
              <text style={{ fg: Colors.NEUTRAL }} wrapMode="none">
                {' '}{credential.description}
              </text>
            </box>
          );
        })}
      </box>

      <box style={{ paddingLeft: 1, paddingRight: 1, border: true, borderColor: Colors.DIM, flexDirection: 'column' }}>
        <text style={{ fg: Colors.PRIMARY }} wrapMode="none">
          Enter/e/Double-click: Open .env in editor  |  q/Esc: Close
        </text>
        <text style={{ fg: Colors.PRIMARY }} wrapMode="none">
          {envPath}
        </text>
      </box>
    </box>
  );
}
