import { useKeyboard } from "@opentui/react";
import { TextAttributes, type ParsedKey } from "@opentui/core";
import { Colors } from "../colors";
import { useState } from "react";
import { Atom } from "effect/unstable/reactivity"
import { useAtomValue, useAtomSet } from "@effect/atom-react";
import type { PipelineJob, PipelineStage } from "../domain/merge-request-schema";
import type { MergeRequest } from "./MergeRequestPane";
import { loadJobLogAtom, jobLogDownloadSignalAtom } from "../mergerequests/open-pipelinejob-log-atom";
import { getJobStatusDisplay } from "../domain/display/jobStatus";
import { pipelineJobImportanceAtom } from "../settings/settings-atom";

export const jobPickerItemsAtom = Atom.make<readonly { job: PipelineJob; stage: PipelineStage }[]>([]);
export const jobPickerMrAtom = Atom.make<MergeRequest | null>(null);

interface JobPickerModalProps {
  onClose: () => void;
}

export default function JobPickerModal({ onClose }: JobPickerModalProps) {
  const items = useAtomValue(jobPickerItemsAtom);
  const mr = useAtomValue(jobPickerMrAtom);
  const setLoadJobLog = useAtomSet(loadJobLogAtom, { mode: 'promiseExit' });
  const setDownloadSignal = useAtomSet(jobLogDownloadSignalAtom);
  const jobImportanceMap = useAtomValue(pipelineJobImportanceAtom);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const projectImportance = mr
    ? jobImportanceMap.get(mr.project.fullPath) ?? new Map<string, string>()
    : new Map<string, string>();

  const sortedItems = sortMonitoredFirst(items, projectImportance);

  const confirmSelection = (index: number) => {
    const item = sortedItems[index];
    if (!item || !mr) return;
    setLoadJobLog({ mergeRequest: mr, job: item.job }).then(() => {
      setDownloadSignal(Date.now());
    });
    onClose();
  };

  useKeyboard((key: ParsedKey) => {
    const num = parseInt(key.name);
    if (!isNaN(num) && num >= 0 && num < sortedItems.length) {
      confirmSelection(num);
      return;
    }

    switch (key.name) {
      case 'j':
      case 'down':
        setSelectedIndex(i => Math.min(i + 1, sortedItems.length - 1));
        break;
      case 'k':
      case 'up':
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'return':
        confirmSelection(selectedIndex);
        break;
      case 'escape':
        onClose();
        break;
    }
  });

  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <box
        style={{
          width: 80,
          border: true,
          borderColor: Colors.PRIMARY,
          backgroundColor: Colors.BACKGROUND,
          padding: 2,
          flexDirection: "column",
          gap: 1,
        }}
      >
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }}
          wrapMode='none'
        >
          Open Job Log
        </text>

        <box style={{ flexDirection: "column" }}>
          {sortedItems.map(({ stage, job }, i) => {
            const importance = projectImportance.get(job.name) ?? 'low';
            const isSelected = i === selectedIndex;
            return (
              <box
                key={job.id}
                onMouseOver={() => setSelectedIndex(i)}
                onMouseDown={() => confirmSelection(i)}
                style={{ ...(isSelected && { backgroundColor: Colors.TRACK }) }}
              >
                <text
                  style={{
                    fg: isSelected ? Colors.PRIMARY : Colors.NEUTRAL,
                    attributes: isSelected ? TextAttributes.BOLD : 0,
                  }}
                  wrapMode='none'
                >
                  {isSelected ? '> ' : '  '}
                  [{i}] {getJobStatusDisplay(job.status).symbol} {stage.name}: {job.name}
                  {importance === 'monitored' ? ' ■' : ''}
                </text>
              </box>
            );
          })}
        </box>

        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          0-{sortedItems.length - 1}/j/k to select, Enter to confirm, ESC to cancel
        </text>
      </box>
    </box>
  );
}

const sortMonitoredFirst = (
  items: readonly { job: PipelineJob; stage: PipelineStage }[],
  projectImportance: Map<string, string>,
): readonly { job: PipelineJob; stage: PipelineStage }[] => {
  const monitored = items.filter(({ job }) => projectImportance.get(job.name) === 'monitored');
  const rest = items.filter(({ job }) => projectImportance.get(job.name) !== 'monitored');
  return [...monitored, ...rest];
};
