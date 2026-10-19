import { getProfileImageUrl, initialsFor } from "../lib/profiles";

export default function ProfileAvatar({ name, path, previewUrl = "", className = "h-24 w-24 text-2xl", round = false }) {
  const imageUrl = previewUrl || getProfileImageUrl(path);
  const radiusClass = round ? "rounded-full" : "rounded-[1.5rem]";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${name}'s profile`}
        className={`${className} ${radiusClass} shrink-0 border border-line bg-white object-cover shadow-sm`}
      />
    );
  }

  return (
    <span
      className={`${className} ${radiusClass} grid shrink-0 place-items-center bg-ink font-black tracking-[-0.04em] text-white shadow-sm`}
      aria-label={`${name}'s initials`}
    >
      {initialsFor(name)}
    </span>
  );
}
