import { useState, useRef } from 'react';
import { TextAttributes, type ParsedKey, type InputRenderable } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { Colors } from '../colors';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { selectedMrAtom } from '../mergerequests/mergerequests-atom';
import { activeModalAtom } from '../ui/navigation-atom';
import { jobHistoryQueryAtom } from './JobHistoryModal';

interface JobHistoryInputModalProps {
  onClose: () => void;
}

type FocusedField = 'projectPath' | 'jobName';

export default function JobHistoryInputModal({ onClose }: JobHistoryInputModalProps) {
  const selectedMr = useAtomValue(selectedMrAtom);
  const setActiveModal = useAtomSet(activeModalAtom);
  const setJobHistoryQuery = useAtomSet(jobHistoryQueryAtom);

  const [projectPath, setProjectPath] = useState(() => selectedMr?.project.fullPath ?? '');
  const [jobName, setJobName] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>('jobName');

  const projectPathRef = useRef<InputRenderable>(null);
  const jobNameRef = useRef<InputRenderable>(null);

  const submit = () => {
    const trimmedProject = projectPath.trim();
    const trimmedJob = jobName.trim();
    if (!trimmedProject || !trimmedJob) return;

    setJobHistoryQuery({ projectPath: trimmedProject, jobName: trimmedJob });
    setActiveModal('jobHistory');
  };

  useKeyboard((key: ParsedKey) => {
    if (key.name === 'escape') {
      onClose();
    } else if (key.name === 'tab') {
      setFocusedField(focusedField === 'projectPath' ? 'jobName' : 'projectPath');
    }
  });

  const handleProjectPathSubmit = () => {
    setFocusedField('jobName');
  };

  const handleJobNameSubmit = () => {
    submit();
  };

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <box
        style={{
          width: 70,
          border: true,
          borderColor: Colors.INFO,
          backgroundColor: Colors.BACKGROUND,
          padding: 2,
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <text
          style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }}
          wrapMode="none"
        >
          Job History Lookup
        </text>

        {/* Project path field */}
        <box style={{ flexDirection: 'column' }}>
          <text
            style={{
              fg: focusedField === 'projectPath' ? Colors.PRIMARY : Colors.SUPPORTING,
              attributes: focusedField === 'projectPath' ? TextAttributes.BOLD : TextAttributes.NONE,
            }}
            wrapMode="none"
          >
            Project path:
          </text>
          <input
            ref={projectPathRef}
            focused={focusedField === 'projectPath'}
            value={projectPath}
            placeholder="group/project"
            style={{
              width: 60,
            }}
            backgroundColor={Colors.TRACK}
            textColor={Colors.PRIMARY}
            focusedBackgroundColor={Colors.SELECTED}
            focusedTextColor={Colors.PRIMARY}
            placeholderColor={Colors.SUPPORTING}
            cursorColor={Colors.INFO}
            onInput={setProjectPath}
            onSubmit={handleProjectPathSubmit}
          />
        </box>

        {/* Job name field */}
        <box style={{ flexDirection: 'column' }}>
          <text
            style={{
              fg: focusedField === 'jobName' ? Colors.PRIMARY : Colors.SUPPORTING,
              attributes: focusedField === 'jobName' ? TextAttributes.BOLD : TextAttributes.NONE,
            }}
            wrapMode="none"
          >
            Job name:
          </text>
          <input
            ref={jobNameRef}
            focused={focusedField === 'jobName'}
            value={jobName}
            placeholder="e.g. test1"
            style={{
              width: 60,
            }}
            backgroundColor={Colors.TRACK}
            textColor={Colors.PRIMARY}
            focusedBackgroundColor={Colors.SELECTED}
            focusedTextColor={Colors.PRIMARY}
            placeholderColor={Colors.SUPPORTING}
            cursorColor={Colors.INFO}
            onInput={setJobName}
            onSubmit={handleJobNameSubmit}
          />
        </box>

        {/* Footer hints */}
        <box style={{ marginTop: 1, flexDirection: 'column' }}>
          <text style={{ fg: Colors.SUPPORTING, attributes: TextAttributes.DIM }} wrapMode="none">
            Tab: switch field | Enter: submit/next | Esc: cancel
          </text>
        </box>
      </box>
    </box>
  );
}
