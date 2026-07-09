from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = ROOT.parent
SAMPLES_DIR = PROJECT_ROOT / "samples"
CHECKPOINTS_DIR = ROOT / "checkpoints"
DEFAULT_MODEL_PATH = CHECKPOINTS_DIR / "simple_cnn.pth"
