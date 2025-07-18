using System;
using Unity.Netcode;
using UnityEngine;

public class NetworkTransformTest : NetworkBehaviour
{
    public float moveSpeed = 1f;

    void Update()
    {
        if (!IsOwner) return; // 오직 로컬 플레이어만 입력 처리

        float h = Input.GetAxisRaw("Horizontal"); // A/D 또는 좌/우
        float v = Input.GetAxisRaw("Vertical");   // W/S 또는 상/하
        Vector3 direction = new Vector3(h, 0, v).normalized;

        if (direction.sqrMagnitude > 0f)
        {
            MoveServerRpc(direction, moveSpeed * Time.deltaTime);
        }
    }

    [ServerRpc]
    void MoveServerRpc(Vector3 direction, float moveAmount)
    {
        // 서버에서만 위치 갱신
        transform.position += direction * moveAmount;
    }
}