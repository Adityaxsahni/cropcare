"""Checks that a .tflite file will run on the phone's default CPU path.

LiteRT applies the XNNPACK delegate by default, on Android as in Python. A
model XNNPACK refuses can fail to load in the app, so every exported file is
loaded here with XNNPACK on.

Known case (found 2026-10-22): in Keras's ImageNet MobileNetV3-Large, the
squeeze-excite ReLU of block expanded_conv_3 outputs zero for every natural
image. Full-integer calibration then gives that tensor a scale near 1e-8, and
XNNPACK refuses the model. `degenerate_nodes` finds such tensors so the
converter can keep just those ops in float.
"""

from __future__ import annotations

import numpy as np
from ai_edge_litert.interpreter import Interpreter, OpResolverType

MIN_SCALE = 1e-6


def runs_with_xnnpack(model: bytes) -> tuple[bool, str]:
    try:
        interp = Interpreter(model_content=model)
        interp.allocate_tensors()
        inp = interp.get_input_details()[0]
        interp.set_tensor(inp["index"], np.zeros(inp["shape"], inp["dtype"]))
        interp.invoke()
        return True, ""
    except (RuntimeError, ValueError) as e:
        return False, str(e).splitlines()[0]


def degenerate_nodes(model: bytes) -> list[str]:
    """Output names of ops that produce or consume an int8 tensor with a near-zero scale."""
    interp = Interpreter(model_content=model, experimental_op_resolver_type=OpResolverType.BUILTIN_WITHOUT_DEFAULT_DELEGATES)
    tensors = {t["index"]: t for t in interp.get_tensor_details()}
    bad = {
        i for i, t in tensors.items()
        if t["dtype"] in (np.int8, np.uint8) and 0 < t["quantization"][0] < MIN_SCALE and "pseudo_qconst" not in t["name"]
    }
    nodes: set[str] = set()
    for op in interp._get_ops_details():
        if bad & set(op["outputs"]) or bad & set(op["inputs"]):
            nodes.update(tensors[i]["name"] for i in op["outputs"])
    return sorted(nodes)
