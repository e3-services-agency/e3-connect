import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Copy, CheckCircle2, Link as LinkIcon, Code } from 'lucide-react';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  bookingUrl: string;
}

const EmbedModal: React.FC<EmbedModalProps> = ({ isOpen, onClose, entityName, bookingUrl }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // We add ?embed=true so your routing can hide website navigation/footers when embedded
  const embedCode = `<iframe src="${bookingUrl}?embed=true" width="100%" height="700" frameborder="0" style="border: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); background: transparent;"></iframe>`;

  const copyToClipboard = async (text: string, type: 'link' | 'embed') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-e3-space-blue border-e3-white/20 text-e3-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-e3-emerald">
            Share & Embed Booking Page
          </DialogTitle>
          <p className="text-sm text-e3-white/60">
            Share <span className="text-e3-azure font-bold">{entityName}</span>'s scheduling flow.
          </p>
        </DialogHeader>

        <div className="space-y-8 py-4">
          {/* Direct Link Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2 text-e3-white">
              <LinkIcon className="w-4 h-4 text-e3-azure" />
              1. Direct Link
            </h4>
            <p className="text-xs text-e3-white/60">Send this URL directly to clients in an email or message.</p>
            <div className="flex items-center gap-2">
              <input 
                readOnly 
                value={bookingUrl} 
                className="flex-1 bg-e3-space-blue/50 border border-e3-white/20 rounded-md px-3 py-2 text-sm text-e3-white outline-none"
              />
              <Button 
                onClick={() => copyToClipboard(bookingUrl, 'link')}
                className="bg-e3-azure hover:bg-e3-azure/90 text-white min-w-[100px]"
              >
                {copiedLink ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>
          </div>

          <div className="h-px bg-e3-white/10 w-full" />

          {/* Embed Code Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2 text-e3-white">
              <Code className="w-4 h-4 text-e3-emerald" />
              2. Website Embed Code
            </h4>
            <p className="text-xs text-e3-white/60">Paste this HTML snippet into your website builder (WordPress, Webflow, Squarespace, Wix) to show the booking flow directly on your site.</p>
            <div className="relative">
              <textarea 
                readOnly 
                value={embedCode} 
                className="w-full h-28 p-3 rounded-md bg-e3-space-blue/50 border border-e3-white/20 text-e3-white text-xs resize-none font-mono outline-none"
              />
              <Button 
                onClick={() => copyToClipboard(embedCode, 'embed')}
                className="absolute top-2 right-2 bg-e3-emerald hover:bg-e3-emerald/90 text-e3-space-blue h-8 text-xs font-medium"
              >
                {copiedEmbed ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copiedEmbed ? 'Copied!' : 'Copy Code'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmbedModal;