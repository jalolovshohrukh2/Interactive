import Label from '../ui/Label.jsx';

// Metadata fields for the current plan level:
//   project  → the complex's name (the image is the master plan)
//   building → the building's name (the image is one building)
//   floor    → building name + the floor range this one plan/SVG applies to
//              (e.g. one identical layout used for floors 1–10)
// Purely descriptive — saved with the project, not drawn.
export default function BuildingInfo({
  planType = 'floor',
  siteName, onSiteNameChange,
  buildingName, onBuildingNameChange,
  floorFrom, onFloorFromChange,
  floorTo, onFloorToChange,
}) {
  const input =
    'w-full bg-[#0a0a0c] border border-[#26262a] rounded-md px-2.5 h-8 text-[12px] text-white outline-none focus:border-violet-500/60 transition-colors';
  return (
    <div className="px-3 pt-3 pb-3 flex-shrink-0 border-b border-[#1f1f22] space-y-2.5">
      {planType === 'project' ? (
        <div>
          <Label>Project name</Label>
          <input
            type="text"
            value={siteName || ''}
            onChange={(e) => onSiteNameChange?.(e.target.value)}
            placeholder="e.g. Green Park Residence"
            className={`mt-1 ${input}`}
          />
        </div>
      ) : (
        <div>
          <Label>Building</Label>
          <input
            type="text"
            value={buildingName || ''}
            onChange={(e) => onBuildingNameChange?.(e.target.value)}
            placeholder="Building name"
            className={`mt-1 ${input}`}
          />
        </div>
      )}
      {planType === 'floor' && (
        <div>
          <Label>Floors this plan covers</Label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              value={floorFrom}
              onChange={(e) => onFloorFromChange(e.target.value)}
              placeholder="1"
              className={`${input} text-center`}
            />
            <span className="text-[11px] text-[#6a6a70] flex-shrink-0">to</span>
            <input
              type="number"
              value={floorTo}
              onChange={(e) => onFloorToChange(e.target.value)}
              placeholder="10"
              className={`${input} text-center`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
