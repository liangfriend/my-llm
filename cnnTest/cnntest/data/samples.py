from torch.utils.data import DataLoader
from torchvision import datasets, transforms

from cnntest.paths import SAMPLES_DIR

INPUT_SIZE = 224
MAX_TRANSLATE_PX = 20

# 推理：灰度、固定缩放，不做随机增强
detect_transform = transforms.Compose([
    transforms.Resize((INPUT_SIZE, INPUT_SIZE)),
    # 转换为灰度图，1 通道 png默认是3通道，需要转换成1通道
    transforms.Grayscale(num_output_channels=1),
    transforms.ToTensor(),
])

# 训练：灰度，在 224×224 画布上做 ±15° 旋转、±20px 平移
train_transform = transforms.Compose([
    transforms.Resize((INPUT_SIZE, INPUT_SIZE)),
    transforms.RandomAffine(
        degrees=15,
        translate=(MAX_TRANSLATE_PX / INPUT_SIZE, MAX_TRANSLATE_PX / INPUT_SIZE),
    ),
    transforms.Grayscale(num_output_channels=1),
    transforms.ToTensor(),
])

# 读取数据集
# ImageFolder 要求 samples/ 大致是这样：
#
# samples/
# ├── 类别A/     ← 子文件夹名 = 类别名
# │   ├── img1.jpg
# │   └── img2.jpg
# └── 类别B/
#     ├── img3.jpg
#     └── img4.jpg
dataset = datasets.ImageFolder(
    root=str(SAMPLES_DIR),
    transform=train_transform,
)

# 批量加载
loader = DataLoader(
    dataset,
    batch_size=32,  # 每次取 32 张图
    shuffle=True,  # 每个 epoch 打乱顺序，训练时更常用
)

if __name__ == "__main__":
    for images, labels in loader:
        print(images.shape)
        print(labels.shape)
        break
