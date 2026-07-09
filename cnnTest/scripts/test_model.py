import torch
import torch.nn as nn

from cnntest.data import dataset, loader
from cnntest.models import SimpleCNN


def test_forward(model, device):
    model.eval()
    images, labels = next(iter(loader))
    images = images.to(device)

    with torch.no_grad():
        outputs = model(images)

    print("=== forward ===")
    print(f"input shape:  {tuple(images.shape)}")
    print(f"output shape: {tuple(outputs.shape)}")
    print(f"labels shape: {tuple(labels.shape)}")
    return outputs, labels


def test_backward(model, device):
    model.train()
    images, labels = next(iter(loader))
    images = images.to(device)
    labels = labels.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.SGD(model.parameters(), lr=0.01)

    outputs = model(images)
    loss = criterion(outputs, labels)
    loss_before = loss.item()

    model.backward(loss, optimizer)

    grad_norm = model.conv1.weight.grad.norm().item()

    print("=== backward ===")
    print(f"loss before step: {loss_before:.4f}")
    print(f"conv1 grad norm:  {grad_norm:.6f}")
    print("gradients computed and parameters updated")


def main():
    device = torch.device("cpu")
    model = SimpleCNN(num_classes=len(dataset.classes)).to(device)

    test_forward(model, device)
    test_backward(model, device)


if __name__ == "__main__":
    main()
