import { Upload, Image as ImageIcon } from 'lucide-react';

export default function EmptyCanvas({ onUpload }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-violet-500/30">
          <ImageIcon size={24} className="text-white" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Upload an image to begin</h2>
        <p className="text-[13px] text-[#8a8a90] mb-6 leading-relaxed">
          Drop a render, plan, or photo. Draw rectangles, polygons, polylines, or ellipses over it,
          then export an interactive SVG with hover effects baked in.
        </p>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 h-10 rounded-md bg-violet-500 hover:bg-violet-400 text-white text-[13px] font-medium transition-colors">
          <Upload size={14} />
          Choose image
          <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
        </label>
        <div className="mt-6 text-[10px] uppercase tracking-wider text-[#5a5a60] font-mono">
          PNG · JPG · WebP · SVG · Saved locally
        </div>
      </div>
    </div>
  );
}
