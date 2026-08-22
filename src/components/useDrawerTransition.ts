import { useEffect, useRef, useState } from 'react';

export function useDrawerTransition(visible: boolean, onDismiss: () => void) {
  const [mounted, setMounted] = useState(visible);
  const [sheetVisible, setSheetVisible] = useState(visible);
  const dismissRequested = useRef(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(
    () => () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    },
    [],
  );

  useEffect(() => {
    // Mirroring the controlled state is required so the modal remains mounted
    // while its independently animated sheet completes the closing transition.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(visible || mounted);
    setSheetVisible(visible);
  }, [mounted, visible]);

  const dismiss = () => {
    dismissRequested.current = true;
    setSheetVisible(false);
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    fallbackTimer.current = setTimeout(onHidden, 320);
  };
  const onShow = () => setSheetVisible(true);
  const onHidden = () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    fallbackTimer.current = null;
    setMounted(false);
    if (dismissRequested.current) {
      dismissRequested.current = false;
      onDismissRef.current();
    }
  };

  return { mounted, sheetVisible, dismiss, onShow, onHidden };
}
