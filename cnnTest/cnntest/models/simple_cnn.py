import torch
from torch import nn
import torch.nn.functional as F


class SimpleCNN(nn.Module):
    def __init__(self, num_classes=2):
        super(SimpleCNN, self).__init__()
        # 输入 1 通道灰度图，输出 32 通道
        self.conv1 = nn.Conv2d(1, 32, kernel_size=3, stride=1, padding=1)
        # 输入 32 通道，输出 64 通道
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, stride=1, padding=1)
        # 自适应池化，将特征图统一缩放到 7x7
        self.pool = nn.AdaptiveAvgPool2d((7, 7))
        # 定义全连接层
        self.fc1 = nn.Linear(64 * 7 * 7, 128)  # 输入大小 = 特征图大小 * 通道数
        self.fc2 = nn.Linear(128, num_classes)  # 输出类别数

    def forward(self, x):
        x = F.relu(self.conv1(x))  # 第一层卷积 + ReLU
        x = F.max_pool2d(x, 2)     # 最大池化
        x = F.relu(self.conv2(x))  # 第二层卷积 + ReLU
        x = F.max_pool2d(x, 2)     # 最大池化
        x = self.pool(x)           # 自适应池化，将特征图统一缩放到 7x7
        x = x.view(x.size(0), -1)  # 展平操作
        x = F.relu(self.fc1(x))    # 全连接层 + ReLU
        x = self.fc2(x)            # 全连接层输出
        return x

    def backward(self, loss, optimizer):
        optimizer.zero_grad()  # 清空上一步梯度
        loss.backward()        # 反向传播，计算梯度
        optimizer.step()       # 用梯度更新参数

    def save(self, path, classes=None):
        payload = {"state_dict": self.state_dict()}
        if classes is not None:
            payload["classes"] = list(classes)
        torch.save(payload, path)

    def load(self, path, device="cpu"):
        payload = torch.load(path, map_location=device, weights_only=False)
        if isinstance(payload, dict) and "state_dict" in payload:
            state_dict = payload["state_dict"]
        else:
            state_dict = payload
        self.load_state_dict(state_dict)

    @staticmethod
    def read_checkpoint(path, device="cpu"):
        payload = torch.load(path, map_location=device, weights_only=False)
        if isinstance(payload, dict) and "state_dict" in payload:
            state_dict = payload["state_dict"]
            classes = payload.get("classes")
        else:
            state_dict = payload
            classes = None

        num_classes = state_dict["fc2.weight"].shape[0]
        return state_dict, classes, num_classes
