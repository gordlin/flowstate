import { DownloadButton } from "@/components/ui/download-button";

const Index = () => {
  const handleDownload = () => {
    // Replace with actual extension download URL
    window.open("https://chrome.google.com/webstore", "_blank");
  };

  return (
    <div className="relative min-h-screen aurora-bg aurora-animated flex flex-col items-center justify-center overflow-hidden">
      {/* Subtle grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      
      {/* Floating orbs for depth */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-aurora-1/10 blur-3xl float" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-aurora-2/10 blur-3xl float" style={{ animationDelay: '-2s' }} />
      <div className="absolute top-1/2 right-1/3 w-48 h-48 rounded-full bg-aurora-3/10 blur-3xl float" style={{ animationDelay: '-4s' }} />

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
        {/* Extension icon/logo placeholder */}
        <div className="mb-8 w-24 h-24 rounded-3xl bg-secondary/50 backdrop-blur-sm border border-border/50 flex items-center justify-center glow-primary pulse-glow">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent opacity-90" />
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6 text-gradient">
          FlowState
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-muted-foreground max-w-md mb-12 leading-relaxed">
          The Go-To Extension That Simplifies What You See.
        </p>

        {/* Download button */}
        <DownloadButton onClick={handleDownload}>
          Download Now
        </DownloadButton>

        {/* Browser compatibility note */}
        <p className="mt-8 text-sm text-muted-foreground/60">
          Get started now.
        </p>
      </main>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </div>
  );
};

export default Index;
