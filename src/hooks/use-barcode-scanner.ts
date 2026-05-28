import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";

export interface UseBarcodeScannerOptions {
  onScanSuccess: (barcode: string) => void;
  continuous?: boolean;
  debounceMs?: number;
  keyboardThresholdMs?: number;
  keyboardMinLength?: number;
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScanSuccess,
  continuous = true,
  debounceMs = 1500,
  keyboardThresholdMs = 30,
  keyboardMinLength = 3,
  enabled = true,
}: UseBarcodeScannerOptions) {
  // Camera-based scanner states
  const [showScanner, setShowScanner] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [continuousScan, setContinuousScan] = useState(continuous);

  // References for keyboard listener
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // References for duplicate prevention
  const lastScanRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });

  // Play audio beep sound
  const playBeep = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); // Crisp, high-pitch POS beep
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 100);
    } catch (err) {
      console.warn("Could not play scan audio feedback:", err);
    }
  }, []);

  // Handle successful scan (both camera & physical scanner)
  const handleScanResult = useCallback(
    (scannedCode: string) => {
      const now = Date.now();
      const code = scannedCode.trim();
      
      if (!code) return;

      // Throttle/debounce duplicate scans of the same barcode
      if (lastScanRef.current.code === code && now - lastScanRef.current.time < debounceMs) {
        console.log("Duplicate barcode scan ignored:", code);
        return;
      }

      lastScanRef.current = { code, time: now };

      // Sensory feedback
      playBeep();
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }

      // Dispatch global custom event for other listeners
      const customEvent = new CustomEvent("onBarcodeScanned", { detail: code });
      window.dispatchEvent(customEvent);

      // Trigger local callback
      onScanSuccess(code);
    },
    [onScanSuccess, debounceMs, playBeep]
  );

  // Global keyboard listener to intercept physical laser scanners
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (
        e.key === "Shift" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Meta"
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Determine if characters are entered at sub-millisecond or fast keyboard rate
      const isFast = timeDiff <= keyboardThresholdMs;

      // If the delay is larger than threshold, reset buffer.
      // (Unless it's the Enter/Tab finish key, which should finalize the buffer if valid)
      if (!isFast) {
        if (e.key.length === 1) {
          bufferRef.current = e.key;
        } else {
          bufferRef.current = "";
        }
        return;
      }

      // Rapid characters appended to buffer
      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // If we are deep in a fast sequence (>= 2 chars), block keypress from typing in focused fields
        if (bufferRef.current.length >= 2) {
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.key === "Enter" || e.key === "Tab") {
        // Ending character from barcode scanners (appends Enter or Tab)
        if (bufferRef.current.length >= keyboardMinLength) {
          e.preventDefault();
          e.stopPropagation();

          const finalBarcode = bufferRef.current;
          bufferRef.current = "";
          lastKeyTimeRef.current = 0;

          // Clean up stray first character from focused inputs
          const activeEl = document.activeElement;
          if (
            activeEl instanceof HTMLInputElement ||
            activeEl instanceof HTMLTextAreaElement
          ) {
            const firstChar = finalBarcode[0];
            const currentVal = activeEl.value;
            if (currentVal && currentVal.endsWith(firstChar)) {
              activeEl.value = currentVal.slice(0, -1);
              activeEl.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }

          handleScanResult(finalBarcode);
        }
      }
    };

    // Listen on window capturing phase to intercept before inputs do
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, keyboardThresholdMs, keyboardMinLength, handleScanResult]);

  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  const toggleTorch = useCallback(() => {
    setTorchOn((prev) => !prev);
  }, []);

  return {
    showScanner,
    setShowScanner,
    facingMode,
    setFacingMode,
    toggleFacingMode,
    torchOn,
    setTorchOn,
    toggleTorch,
    continuousScan,
    setContinuousScan,
    handleScanResult,
  };
}
