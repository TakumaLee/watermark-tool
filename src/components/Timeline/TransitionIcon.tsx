import { useState, useCallback } from 'react';
import { useEffectsStore } from '../../stores/effectsStore';
import { ALL_TRANSITIONS, TRANSITION_DURATIONS } from '../../types';
import type { ClipTransition, TransitionType, TransitionDuration } from '../../types';

interface TransitionIconProps {
  fromClipId: string;
  toClipId: string;
}

export function TransitionIcon({ fromClipId, toClipId }: TransitionIconProps) {
  const { getTransition, setTransition } = useEffectsStore();
  const [showPicker, setShowPicker] = useState(false);

  const transition = getTransition(fromClipId, toClipId);

  const handleSelect = useCallback(
    (type: TransitionType, duration: TransitionDuration) => {
      const t: ClipTransition = { type, duration };
      setTransition(fromClipId, toClipId, t);
      setShowPicker(false);
    },
    [fromClipId, toClipId, setTransition]
  );

  const handleRemove = useCallback(() => {
    setTransition(fromClipId, toClipId, null);
    setShowPicker(false);
  }, [fromClipId, toClipId, setTransition]);

  const currentDef = transition
    ? ALL_TRANSITIONS.find((t) => t.type === transition.type)
    : null;

  return (
    <div className="relative flex items-center justify-center z-10">
      {/* Transition button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowPicker(!showPicker);
        }}
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px]
                    border transition-all ${
                      transition
                        ? 'bg-accent/20 border-accent text-accent hover:bg-accent/30'
                        : 'bg-bg-primary/80 border-border/50 text-text-secondary/50 hover:border-accent hover:text-accent'
                    }`}
        title={
          transition
            ? `${currentDef?.name || transition.type} (${transition.duration}s)`
            : '添加轉場效果'
        }
      >
        {transition ? currentDef?.icon || '✨' : '+'}
      </button>

      {/* Picker dropdown */}
      {showPicker && (
        <div
          className="absolute top-7 left-1/2 -translate-x-1/2 w-48 bg-bg-secondary border border-border
                     rounded-lg shadow-xl p-2 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-text-secondary mb-1.5 font-medium">轉場效果</div>

          {/* Transition types */}
          <div className="space-y-0.5 mb-2">
            {ALL_TRANSITIONS.map((def) => (
              <button
                key={def.type}
                onClick={() =>
                  handleSelect(def.type, transition?.duration || 1)
                }
                className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
                  transition?.type === def.type
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-bg-primary/50 hover:text-text-primary'
                }`}
              >
                <span>{def.icon}</span>
                <span>{def.name}</span>
              </button>
            ))}
          </div>

          {/* Duration */}
          {transition && (
            <>
              <div className="text-[10px] text-text-secondary mb-1 font-medium">時長</div>
              <div className="flex gap-1 mb-2">
                {TRANSITION_DURATIONS.map((dur) => (
                  <button
                    key={dur}
                    onClick={() => handleSelect(transition.type, dur)}
                    className={`flex-1 px-1 py-0.5 text-[10px] rounded border transition-colors ${
                      transition.duration === dur
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border/50 text-text-secondary hover:border-border'
                    }`}
                  >
                    {dur}s
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Remove */}
          {transition && (
            <button
              onClick={handleRemove}
              className="w-full text-[10px] text-text-secondary hover:text-error py-0.5 transition-colors"
            >
              移除轉場
            </button>
          )}
        </div>
      )}
    </div>
  );
}
