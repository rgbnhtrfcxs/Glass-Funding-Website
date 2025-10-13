import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Waitlist } from "@/components/sections/waitlist";

interface WaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaitlistDialog({ open, onOpenChange }: WaitlistDialogProps) {
  const [key, setKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        onOpenChange(value);
        if (!value) {
          // force remount to reset form submission state
          setKey(prev => prev + 1);
        }
      }}
    >
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">Join the waitlist</DialogTitle>
        <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1.15fr]">
          <div className="p-8" key={key}>
            <Waitlist embedded />
          </div>
          <div className="hidden md:flex flex-col justify-center gap-4 border-l border-border bg-card/60 px-10 py-12">
            <p className="text-base font-medium text-foreground uppercase tracking-[0.25em]">
              Why it matters
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every name on the waitlist is proof that science can belong to everyone. We’ll only reach out
              when there’s meaningful progress—no spam, just breakthroughs the community helps bring to life.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
