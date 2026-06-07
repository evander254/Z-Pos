import { useEffect, useState, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, Zap, ZapOff, RefreshCw, X, AlertTriangle, ScanBarcode, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (code: string) => void;
  facingMode: "environment" | "user";
  setFacingMode: (mode: "environment" | "user") => void;
  torchOn: boolean;
  setTorchOn: (torch: boolean) => void;
  continuousScan: boolean;
  setContinuousScan: (val: boolean) => void;
  title?: string;
  validateCode?: (code: string) => { valid: boolean; message?: string; productName?: string; stock?: number };
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanResult,
  facingMode,
  setFacingMode,
  torchOn,
  setTorchOn,
  continuousScan,
  setContinuousScan,
  title = "Camera Barcode Scanner",
  validateCode,
}: BarcodeScannerModalProps) {
  const [scannerError, setScannerError] = useState<{
    title: string;
    description: string;
    nonSecure?: boolean;
  } | null>(null);

  // Hardware capability states
  const [hasTorch, setHasTorch] = useState(false);
  const [hasAutofocus, setHasAutofocus] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const stableScanRef = useRef<{ code: string; count: number; time: number }>({ code: "", count: 0, time: 0 });

  // Mutex-like ref to prevent overlapping frame decodes
  const isDecodingRef = useRef(false);

  // Initialize stream, autofocus, and capabilities
  useEffect(() => {
    if (!isOpen) {
      setScannerError(null);
      setHasTorch(false);
      setHasAutofocus(false);
      setScanStatus(null);
      return;
    }

    let activeStream: MediaStream | null = null;
    let scanInterval: NodeJS.Timeout | null = null;

    const startCamera = async () => {
      try {
        // 1. Instantiating a hidden Html5Qrcode helper for decode scanning
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.QR_CODE,
          (Html5QrcodeSupportedFormats as any).DATA_MATRIX,
          (Html5QrcodeSupportedFormats as any).PDF_417,
          (Html5QrcodeSupportedFormats as any).AZTEC,
          (Html5QrcodeSupportedFormats as any).ITF,
        ].filter(Boolean);
        html5QrRef.current = new Html5Qrcode("dummy-html5qr-reader", {
          verbose: false,
          formatsToSupport,
        });

        // 2. Request camera stream with horizontal resolution optimization
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        try {
          activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          console.warn("Optimal camera resolution constraint failed, trying fallback stream:", err);
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
          });
        }

        streamRef.current = activeStream;

        // Assign stream to video player
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
          // Play the stream once browser allows it
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn("Video failed to play immediately:", playErr);
          }
        }

        // 3. Query native hardware capabilities of active video track
        const track = activeStream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === "function") {
          try {
            const capabilities = track.getCapabilities() as any;
            
            // Check flashlight/torch support
            setHasTorch(!!capabilities.torch);

            // Check continuous autofocus support
            if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
              setHasAutofocus(true);
              // Apply continuous focus constraint immediately
              await track.applyConstraints({
                advanced: [{ focusMode: "continuous" } as any],
              });
              console.log("Applied hardware continuous autofocus constraint.");
            }

            const advanced: any[] = [];
            if (capabilities.exposureMode?.includes?.("continuous")) advanced.push({ exposureMode: "continuous" });
            if (capabilities.whiteBalanceMode?.includes?.("continuous")) advanced.push({ whiteBalanceMode: "continuous" });
            if (capabilities.zoom) {
              const targetZoom = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min, capabilities.zoom.min + 0.25));
              advanced.push({ zoom: targetZoom });
            }
            if (advanced.length) await track.applyConstraints({ advanced });
          } catch (capsErr) {
            console.warn("Failed to apply advanced camera focus capabilities:", capsErr);
          }
        }

        // 4. Setup the custom preprocessed frame scan loop throttled to 4.5 FPS (every 220ms)
        scanInterval = setInterval(() => {
          processAndScanFrame();
        }, 220);

      } catch (err) {
        console.error("Camera scanner startup failed:", err);
        const isSecure =
          window.location.protocol === "https:" ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";

        if (!isSecure) {
          setScannerError({
            title: "Camera Blocked: Non-Secure Context",
            description:
              "Browsers block camera access unless served over HTTPS or localhost for security. Please deploy/run via HTTPS.",
            nonSecure: true,
          });
        } else {
          setScannerError({
            title: "Camera Access Failed",
            description:
              "Ensure camera permissions are granted. Close other applications that may be using the camera, or toggle camera options.",
          });
        }
      }
    };

    // Delay initialization slightly to let the dialog mount completely
    const timer = setTimeout(startCamera, 200);

    return () => {
      clearTimeout(timer);
      if (scanInterval) {
        clearInterval(scanInterval);
      }
      
      // Stop stream tracks cleanly
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }

      // Clear helper
      if (html5QrRef.current) {
        html5QrRef.current.clear();
        html5QrRef.current = null;
      }
    };
  }, [isOpen, facingMode]);

  // Synchronize torch constraint with changes to torchOn state
  useEffect(() => {
    const applyTorch = async () => {
      if (!streamRef.current) return;
      const track = streamRef.current.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === "function") {
        try {
          const capabilities = track.getCapabilities() as any;
          if (capabilities.torch) {
            await track.applyConstraints({
              advanced: [{ torch: torchOn } as any],
            });
          }
        } catch (err) {
          console.warn("Could not modify torch constraint:", err);
        }
      }
    };
    applyTorch();
  }, [torchOn]);

  // The Canvas Cropping and Pixel Preprocessing loop
  const processAndScanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const decoder = html5QrRef.current;

    // Check if elements are ready and a decode isn't currently running
    if (
      !video ||
      !canvas ||
      !decoder ||
      video.readyState < 2 || // HAVE_CURRENT_DATA or higher
      video.videoWidth === 0 ||
      video.videoHeight === 0 ||
      isDecodingRef.current
    ) {
      return;
    }

    try {
      isDecodingRef.current = true;

      // 1. Calculate bounding box dimensions relative to native video resolution
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;

      // Crop only the visible target zone. This reduces false positives from shelf labels/background text.
      const cropWidth = Math.floor(vWidth * 0.84);
      const cropHeight = Math.floor(vHeight * 0.34);
      const cropX = Math.floor((vWidth - cropWidth) / 2);
      const cropY = Math.floor((vHeight - cropHeight) / 2);

      // Set off-screen canvas dimensions to match the cropped region
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        isDecodingRef.current = false;
        return;
      }

      // Draw cropped bounding box region from video to canvas
      ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      // 2. Perform canvas-level pixel manipulation (Grayscale & Contrast Boost)
      const imgData = ctx.getImageData(0, 0, cropWidth, cropHeight);
      const data = imgData.data;

      // Contrast adjustment calculations
      const contrast = 100; // Boost contrast heavily (Value range -255 to 255)
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Convert to Grayscale using the Luminosity formula
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // Apply contrast factor around center gray (128)
        gray = factor * (gray - 128) + 128;

        // Clamp to valid 0-255 boundaries
        if (gray < 0) gray = 0;
        if (gray > 255) gray = 255;

        data[i] = gray;       // Red
        data[i + 1] = gray;   // Green
        data[i + 2] = gray;   // Blue
        // data[i+3] is Alpha, remains unchanged
      }

      // Put the modified pixels back onto our canvas
      ctx.putImageData(imgData, 0, 0);

      // 3. Convert processed canvas to a file blob and feed to decoder
      canvas.toBlob((blob) => {
        if (!blob) {
          isDecodingRef.current = false;
          return;
        }

        const file = new File([blob], "scan-frame.png", { type: "image/png" });

        decoder
          .scanFileV2(file, false)
          .then((result) => {
            if (result && result.decodedText) {
              const decodedCode = result.decodedText.trim();
              const now = Date.now();
              const stable = stableScanRef.current;

              if (stable.code === decodedCode && now - stable.time < 1200) {
                stableScanRef.current = { code: decodedCode, count: stable.count + 1, time: now };
              } else {
                stableScanRef.current = { code: decodedCode, count: 1, time: now };
              }

              // Require two consecutive reads of the same code from the target zone before accepting.
              if (stableScanRef.current.count >= 2) {
                const validation = validateCode?.(decodedCode);
                if (validation && !validation.valid) {
                  setScanStatus({ type: "error", text: validation.message || `Not in inventory: ${decodedCode}` });
                  toast.warning(validation.message || `Barcode not registered: ${decodedCode}`, {
                    description: "Scan a product barcode that exists in your inventory.",
                    duration: 2500,
                  });
                  stableScanRef.current = { code: "", count: 0, time: 0 };
                } else {
                  setScanStatus({
                    type: "success",
                    text: validation?.productName
                      ? `Available: ${validation.productName}${typeof validation.stock === "number" ? ` (${validation.stock} in stock)` : ""}`
                      : `Available: ${decodedCode}`,
                  });
                  onScanResult(decodedCode);
                  stableScanRef.current = { code: "", count: 0, time: 0 };
                  if (!continuousScan) {
                    onClose();
                  }
                }
              }
            }
            isDecodingRef.current = false;
          })
          .catch(() => {
            // Silence decoding failures (normal when frame has no barcode)
            isDecodingRef.current = false;
          });
      }, "image/png");

    } catch (err) {
      console.warn("Error in scanner processing loop:", err);
      isDecodingRef.current = false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-white p-6 rounded-2xl overflow-hidden flex flex-col z-[9999]">
        
        {/* Dynamic laser sweeps and hover effects */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @keyframes laser-sweep {
              0% { transform: translateY(0px); opacity: 0.8; }
              50% { transform: translateY(124px); opacity: 1; filter: drop-shadow(0 0 4px #ef4444); }
              100% { transform: translateY(0px); opacity: 0.8; }
            }
            .animate-laser-line {
              animation: laser-sweep 2.2s infinite linear;
            }
          `,
          }}
        />

        <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-900 pb-3 mb-2 shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-indigo-400 animate-pulse" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Camera stream container */}
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black border border-slate-900 flex items-center justify-center">
          {/* HTML5 Video element rendering the track */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />

          {/* Visible scanning guide target reticle overlay */}
          {!scannerError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Central Bounding Box matching our crop percentages */}
              <div className="w-[84%] h-[34%] border-2 border-indigo-500/70 rounded-xl relative shadow-[0_0_0_9999px_rgba(3,7,18,0.76)]">
                
                {/* Visual Corner bracket indicators */}
                <div className="absolute -top-1 -left-1 w-4.5 h-4.5 border-t-4 border-l-4 border-indigo-400 rounded-tl-sm"></div>
                <div className="absolute -top-1 -right-1 w-4.5 h-4.5 border-t-4 border-r-4 border-indigo-400 rounded-tr-sm"></div>
                <div className="absolute -bottom-1 -left-1 w-4.5 h-4.5 border-b-4 border-l-4 border-indigo-400 rounded-bl-sm"></div>
                <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 border-b-4 border-r-4 border-indigo-400 rounded-br-sm"></div>

                {/* Vertical sweeping laser animation */}
                <div className="absolute left-1 right-1 top-2 h-0.5 bg-rose-500 shadow-[0_0_10px_#ef4444] rounded-full animate-laser-line"></div>
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 border-t border-dashed border-white/45"></div>
                <div className="absolute -bottom-7 left-0 right-0 text-center text-[10px] font-semibold text-white/80">
                  Keep only one barcode inside this box
                </div>
              </div>
            </div>
          )}

          {/* Dummy hidden element required to instantiate Html5Qrcode class */}
          <div id="dummy-html5qr-reader" className="hidden" />

          {/* Debug Preview Monitor of Grayscale/Contrast cropped canvas */}
          {showDebug && (
            <div className="absolute bottom-3 right-3 z-20 bg-slate-950/90 border border-indigo-500/40 p-2 rounded-lg pointer-events-none">
              <span className="block text-[8px] text-indigo-400 font-bold uppercase tracking-wider mb-1">
                Optimized Preprocessor
              </span>
              <canvas ref={canvasRef} className="w-32 h-auto rounded border border-slate-800" />
            </div>
          )}

          {/* Fallback Error Screens */}
          {scannerError && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="h-12 w-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-rose-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-100 mb-1">{scannerError.title}</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-normal mb-4">
                {scannerError.description}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setScannerError(null);
                    setFacingMode(facingMode === "environment" ? "user" : "environment");
                  }}
                  className="h-9 px-4 text-xs font-semibold bg-slate-900 border-slate-800 text-white cursor-pointer hover:bg-slate-800"
                >
                  Retry Camera
                </Button>
                <Button
                  onClick={onClose}
                  className="h-9 px-4 text-xs font-semibold bg-slate-100 hover:bg-white text-black cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!scannerError && scanStatus && (
            <div className={`absolute left-3 right-3 bottom-3 z-20 rounded-xl border px-3 py-2 text-xs font-semibold shadow-lg ${scanStatus.type === "success" ? "bg-emerald-500/90 border-emerald-300 text-white" : "bg-rose-500/90 border-rose-300 text-white"}`}>
              {scanStatus.text}
            </div>
          )}
        </div>

        {/* Modal Controls */}
        <div className="mt-5 space-y-4 shrink-0">
          
          {/* Continuous Scan and Preprocessor monitor toggles */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-900 px-3 py-2 rounded-xl text-[11px] text-slate-300">
              <span className="font-semibold text-slate-200">Continuous Scan</span>
              <Switch
                checked={continuousScan}
                onCheckedChange={setContinuousScan}
                className="scale-90 cursor-pointer"
              />
            </div>

            <button
              onClick={() => setShowDebug(!showDebug)}
              type="button"
              className="flex items-center justify-between bg-slate-900/60 hover:bg-slate-900 border border-slate-900 hover:border-slate-850 px-3 py-2 rounded-xl text-[11px] text-slate-300 cursor-pointer transition-all"
            >
              <span className="font-semibold text-slate-200">Show Filtered Feed</span>
              {showDebug ? (
                <Eye className="h-4 w-4 text-indigo-400" />
              ) : (
                <EyeOff className="h-4 w-4 text-slate-500" />
              )}
            </button>
          </div>

          <div className="flex gap-2">
            {/* Flash Light Toggle */}
            <Button
              onClick={() => setTorchOn(!torchOn)}
              type="button"
              variant="outline"
              disabled={!!scannerError || !hasTorch}
              className="flex-1 h-11 bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-slate-700 text-white cursor-pointer text-xs font-semibold gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {torchOn ? (
                <>
                  <ZapOff className="h-4 w-4 text-amber-500" />
                  <span>Flash Off</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span>Flash Light</span>
                </>
              )}
            </Button>

            {/* Switch Camera Toggle */}
            <Button
              onClick={() => setFacingMode(facingMode === "environment" ? "user" : "environment")}
              type="button"
              variant="outline"
              disabled={!!scannerError}
              className="flex-1 h-11 bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-slate-700 text-white cursor-pointer text-xs font-semibold gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4 text-indigo-400" />
              <span>Flip Camera</span>
            </Button>
          </div>

          <div className="text-[10px] text-center text-slate-500 leading-normal border-t border-slate-900/50 pt-2.5 flex items-center justify-between">
            <span>Focus: <strong className="text-indigo-400">{hasAutofocus ? "AUTO" : "MANUAL"}</strong></span>
            <span>Active: <strong className="text-indigo-400 uppercase">{facingMode === "environment" ? "REAR" : "FRONT"}</strong></span>
            <span>2D: <strong className="text-indigo-400">ON</strong></span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
