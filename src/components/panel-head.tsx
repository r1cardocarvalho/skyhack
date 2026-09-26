import { Icon, type IconName } from "@/components/icons";

export function PanelHead({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="panel-head">
      <span className="icon-tile icon-tile-sm">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <h2>{title}</h2>
        {hint ? <p className="hint">{hint}</p> : null}
      </div>
    </div>
  );
}
