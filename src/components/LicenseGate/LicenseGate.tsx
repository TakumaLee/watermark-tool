import { useEffect, type ReactNode } from 'react';
import { useLicenseStore } from '../../stores/licenseStore';

interface LicenseGateProps {
  feature: string;
  children: ReactNode;
}

export function LicenseGate({ feature, children }: LicenseGateProps) {
  const { loadLicense, setDialogOpen, hasFeature } = useLicenseStore();

  useEffect(() => {
    loadLicense();
  }, [loadLicense]);

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred/dimmed content */}
      <div className="opacity-30 pointer-events-none select-none blur-[1px]">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary/60 backdrop-blur-sm rounded">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-sm text-text-secondary mb-3">此功能需要 Pro 授權</p>
        <button
          onClick={() => setDialogOpen(true)}
          className="px-4 py-2 text-xs bg-accent text-white rounded hover:bg-accent/80 transition-colors"
        >
          🔑 升級 Pro
        </button>
      </div>
    </div>
  );
}
