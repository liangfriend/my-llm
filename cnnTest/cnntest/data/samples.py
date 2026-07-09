from torch.utils.data import DataLoader
from torchvision import datasets, transforms

from cnntest.paths import SAMPLES_DIR

# 图像预处理
transform = transforms.Compose([
    transforms.Resize((224, 224)),  # 缩放到 224×224 像素
    transforms.ToTensor(),  # 转成 PyTorch 张量，像素值从 0–255 变成约 0–1 的浮点数
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
    transform=transform,
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
