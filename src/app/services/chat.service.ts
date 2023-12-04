import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { switchMap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export interface User {
  uid: string;
  email: string;
}

export interface Message {
  id: string;
  createdAt?: firebase.firestore.Timestamp; // Asegúrate de que estás utilizando 'firebase.firestore.Timestamp' aquí
  from: string;
  msg: string;
  fromName: string;
  myMsg: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  currentUser: User | null = null;
  constructor(private afAuth: AngularFireAuth, private afs: AngularFirestore) {
    this.afAuth.onAuthStateChanged((user) => {
      this.currentUser = user as User | null; // Usa 'as User | null' para decirle a TypeScript que confíe en ti
    });
  }

  async signup({ email, password }: { email: string, password: string }): Promise<any> {
    try {
      const credential = await this.afAuth.createUserWithEmailAndPassword(
        email,
        password
      );

      if (credential?.user) {
        const uid = credential.user.uid;

        return this.afs.doc(
          `users/${uid}`
        ).set({
          uid,
          email: credential.user.email,
        });
      } else {
        // Manejar el caso en que credential.user sea null
        throw new Error("El usuario no se creó correctamente.");
      }
    } catch (error) {
      console.error("Error al crear el usuario:", error);
      throw error; // Puedes manejar el error según tus necesidades
    }
  }

  signIn({ email, password }: { email: string, password: string }) {
    return this.afAuth.signInWithEmailAndPassword(email, password);
  }

  signOut(): Promise<void> {
    return this.afAuth.signOut();
  }

  addChatMessage(msg: string): Promise<any> {
    if (!this.currentUser) {
      // Manejar el caso donde el usuario no está autenticado
      return Promise.reject("Usuario no autenticado");
    }

    return this.afs.collection('messages').add({
      msg: msg,
      from: this.currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp() as any
    });
  }

  getChatMessages() {
    let users: User[] = [];
    return this.getUsers().pipe(
      switchMap(res => {
        users = res;
        return this.afs.collection('messages', ref => ref.orderBy('createdAt')).valueChanges({ idField: 'id' }) as Observable<Message[]>;
      }),
      map(messages => {
        // Get the real name for each user
        for (let m of messages) {
          m.fromName = this.getUserForMsg(m.from, users);
          m.myMsg = this.currentUser !== null && this.currentUser.uid === m.from;
        }
        return messages;
      })
    );
  }

  private getUsers() {
    return this.afs.collection('users').valueChanges({ idField: 'uid' }) as Observable<User[]>;
  }

  private getUserForMsg(msgFromId: string, users: User[]): string {
    for (let usr of users) {
      if (usr.uid == msgFromId) {
        return usr.email;
      }
    }
    return 'Deleted';
  }
}
