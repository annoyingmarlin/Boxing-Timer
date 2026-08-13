# Boxing timer to help with sparring and training. This timer will ask the user for the number of rounds.
# then it will ask for the length of each round and the length of the rest period between rounds. 
# The timer will then start and display the time remaining for each round and rest period. 
# The timer will also give a warning when there are 10 seconds left in each round and rest period.

from time import time


round_length = int(input("Enter the length of each round in seconds: "))
rest_length = int(input("Enter the length of the rest period in seconds: "))
rounds = int(input("Enter the number of rounds: "))

while rounds > 0:
    print(f"Round {rounds} starting now!")
    for i in range(round_length, 0, -1):
        if i == 10:
            print("10 seconds left!")
        print(f"Time remaining: {i} seconds")
        time.sleep(1)
    print("Round over! Time to rest.")
    
    for i in range(rest_length, 0, -1):
        if i == 10:
            print("10 seconds left!")
        print(f"Rest time remaining: {i} seconds")
        time.sleep(1)
    
    rounds -= 1